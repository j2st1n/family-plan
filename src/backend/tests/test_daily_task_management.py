from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.ratelimit import auth_limiter
from app.models.child_vacation import ChildVacation
from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.models.daily_task import DailyTask
from app.models.plan import Plan
from app.models.streak import Streak
from app.models.reward_ledger import RewardLedger
from app.services.daily_tasks import _has_missed_task_day


@pytest.fixture
def family(client):
    auth_limiter._global._buckets.clear()
    response = client.post('/api/v1/auth/register', json={
        'username': 'manage' + uuid4().hex[:8], 'password': 'pass12345',
    })
    assert response.status_code == 201, response.text
    headers = {'Authorization': 'Bearer ' + response.json()['token']}
    response = client.post('/api/v1/children', headers=headers, json={'name': 'test-child'})
    assert response.status_code == 200, response.text
    child_id = response.json()['id']
    code = client.post(f'/api/v1/children/{child_id}/access-code', headers=headers).json()['code']
    response = client.post('/api/v1/child-devices/bind', json={'code': code, 'display_name': 'test'})
    assert response.status_code == 200, response.text
    child_headers = {'Authorization': 'Bearer ' + response.json()['device_token']}
    plans = []
    for title in ['first plan', 'second plan']:
        response = client.post('/api/v1/plans', headers=headers, json={
            'child_id': child_id, 'title': title, 'start_date': str(date.today()),
        })
        assert response.status_code == 201, response.text
        plans.append(response.json()['id'])
    return headers, child_headers, child_id, plans


def create_task(client, headers, plan_id, **fields):
    response = client.post(f'/api/v1/plans/{plan_id}/daily-tasks', headers=headers, json={
        'task_date': str(date.today()),
        'tasks': [{'title': 'test-task', 'expected_minutes': 10, **fields}],
    })
    assert response.status_code == 201, response.text
    return response.json()[0]


def list_tasks(client, headers, plan_id, task_date=None):
    response = client.get(f'/api/v1/plans/{plan_id}/daily-tasks', headers=headers,
                          params={'task_date': str(task_date or date.today())})
    assert response.status_code == 200, response.text
    return response.json()['tasks']


def test_aggregate_tasks_expose_real_plan_and_can_be_edited_and_deleted(client, family):
    headers, child_headers, child_id, plans = family
    first = create_task(client, headers, plans[0])
    second = create_task(client, headers, plans[1])
    tasks = list_tasks(client, headers, plans[0])
    assert {task['id']: task['plan_id'] for task in tasks} == {
        first['id']: plans[0], second['id']: plans[1],
    }
    for task in tasks:
        url = f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}"
        response = client.patch(url, headers=headers, json={'title': 'updated', 'expected_minutes': 15})
        assert response.status_code == 200, response.text
        assert response.json()['title'] == 'updated'
        assert client.delete(url, headers=headers).status_code == 204
    assert list_tasks(client, headers, plans[0]) == []
    assert client.get('/api/v1/child/today', headers=child_headers).json()['tasks'] == []
    assert client.get(f'/api/v1/children/{child_id}/dashboard', headers=headers).json()['today']['total_tasks'] == 0


@pytest.mark.parametrize('method', ['patch', 'delete'])
def test_task_plan_and_family_ownership_checks_remain_enforced(client, family, method):
    headers, _, _, plans = family
    task = create_task(client, headers, plans[1])
    kwargs = {'json': {'title': 'unauthorized'}} if method == 'patch' else {}
    wrong_plan = f"/api/v1/plans/{plans[0]}/daily-tasks/{task['id']}"
    assert getattr(client, method)(wrong_plan, headers=headers, **kwargs).status_code == 404
    auth = client.post('/api/v1/auth/register', json={
        'username': 'other' + uuid4().hex[:8], 'password': 'pass12345',
    })
    assert auth.status_code == 201
    other_headers = {'Authorization': 'Bearer ' + auth.json()['token']}
    real_url = f"/api/v1/plans/{plans[1]}/daily-tasks/{task['id']}"
    assert getattr(client, method)(real_url, headers=other_headers, **kwargs).status_code == 404
    assert len(list_tasks(client, headers, plans[0])) == 1


def test_deleted_routine_stays_deleted_on_both_clients_but_repeats_next_day(client, family, db_session):
    headers, child_headers, _, plans = family
    response = client.post(f'/api/v1/plans/{plans[1]}/task-templates', headers=headers, json={
        'title': 'repeat-task', 'expected_minutes': 10, 'weekdays': [],
    })
    assert response.status_code == 201
    task = list_tasks(client, headers, plans[0])[0]
    url = f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}"
    assert client.delete(url, headers=headers).status_code == 204
    for _ in range(2):
        assert list_tasks(client, headers, plans[0]) == []
        assert client.get('/api/v1/child/today', headers=child_headers).json()['tasks'] == []
    stored = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task['id'])))
    assert stored.status == 'deleted'
    tomorrow = list_tasks(client, headers, plans[0], date.today() + timedelta(days=1))
    assert len(tomorrow) == 1
    assert tomorrow[0]['id'] != task['id']
    assert client.patch(url, headers=headers, json={'title': 'revive'}).status_code == 404
    assert client.delete(url, headers=headers).status_code == 404
    for path, payload in [('complete', {}), ('schedule', {'scheduled_start': '10:00', 'scheduled_end': '10:10'})]:
        assert client.patch(f"/api/v1/child/tasks/{task['id']}/{path}", headers=child_headers, json=payload).status_code == 404


def test_approval_preserves_schedule_and_description(client, family):
    headers, _, _, plans = family
    task = create_task(client, headers, plans[1], description='keep description',
                       scheduled_start='10:00', scheduled_end='10:10')
    response = client.patch(f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}",
                            headers=headers, json={'title': task['title'], 'approved': True})
    assert response.status_code == 200
    assert response.json()['scheduled_start'] == '10:00'
    assert response.json()['scheduled_end'] == '10:10'
    assert response.json()['description'] == 'keep description'
    assert response.json()['expected_minutes'] == 10


def test_completed_task_cannot_be_deleted_or_edited(client, family):
    headers, child_headers, _, plans = family
    task = create_task(client, headers, plans[0], reward_stars=2)
    assert client.patch(f"/api/v1/child/tasks/{task['id']}/complete", headers=child_headers, json={}).status_code == 200
    url = f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}"
    assert client.delete(url, headers=headers).status_code == 409
    assert client.patch(url, headers=headers, json={'title': 'changed'}).status_code == 409
    response = client.get('/api/v1/child/today', headers=child_headers).json()
    assert response['tasks'][0]['status'] == 'completed'
    assert float(response['rewards']['stars_total']) == 2


def test_invalid_time_is_validation_error_without_changing_task(client, family):
    headers, _, _, plans = family
    task = create_task(client, headers, plans[0])
    response = client.patch(f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}",
                            headers=headers, json={'title': 'changed', 'scheduled_start': 'invalid'})
    assert response.status_code == 422
    assert list_tasks(client, headers, plans[0])[0]['title'] == 'test-task'


@pytest.mark.parametrize('stars', [1, 2, 8, 99])
def test_only_changing_stars_persists_in_response_database_and_both_lists(client, family, db_session, stars):
    headers, child_headers, _, plans = family
    task = create_task(client, headers, plans[1], expected_minutes=22)
    response = client.patch(f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}",
                            headers=headers, json={
                                'title': task['title'], 'expected_minutes': 22, 'reward_stars': stars,
                                'scheduled_start': None, 'scheduled_end': None, 'approved': True,
                            })
    assert response.status_code == 200, response.text
    assert response.json()['reward_stars'] == stars
    stored = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task['id'])))
    assert stored.reward_stars == stars
    assert list_tasks(client, headers, plans[0])[0]['reward_stars'] == stars
    child_response = client.get('/api/v1/child/today', headers=child_headers)
    assert child_response.status_code == 200
    assert child_response.json()['tasks'][0]['reward_stars'] == stars


def test_new_routine_appears_when_child_already_has_tasks(client, family):
    headers, child_headers, _, plans = family
    create_task(client, headers, plans[0])
    response = client.post(f'/api/v1/plans/{plans[1]}/task-templates', headers=headers,
                           json={'title': 'new routine', 'expected_minutes': 10})
    assert response.status_code == 201
    response = client.get('/api/v1/child/today', headers=child_headers)
    assert response.status_code == 200
    assert {task['title'] for task in response.json()['tasks']} == {'test-task', 'new routine'}


def test_deleted_task_does_not_reduce_streak_completion_rate(client, family):
    headers, child_headers, child_id, plans = family
    settings = client.get(f'/api/v1/children/{child_id}/reward-settings', headers=headers).json()
    settings.pop('child_id')
    settings['streak_threshold'] = 100
    response = client.patch(f'/api/v1/children/{child_id}/reward-settings', headers=headers,
                            json=settings)
    assert response.status_code == 200, response.text
    deleted = create_task(client, headers, plans[0])
    pending = create_task(client, headers, plans[1])
    assert client.delete(f"/api/v1/plans/{plans[0]}/daily-tasks/{deleted['id']}", headers=headers).status_code == 204
    response = client.patch(f"/api/v1/child/tasks/{pending['id']}/complete", headers=child_headers, json={})
    assert response.status_code == 200, response.text
    assert response.json()['current_streak_days'] == 1


def test_child_cannot_edit_or_delete_a_task_deleted_by_parent(client, family):
    headers, child_headers, _, _ = family
    response = client.post('/api/v1/child/tasks', headers=child_headers,
                           json={'title': 'child task', 'expected_minutes': 10})
    assert response.status_code == 201, response.text
    task = response.json()
    assert client.delete(f"/api/v1/plans/{task['plan_id']}/daily-tasks/{task['id']}", headers=headers).status_code == 204
    response = client.patch(f"/api/v1/child/tasks/{task['id']}", headers=child_headers,
                            json={'title': 'revive', 'expected_minutes': 10})
    assert response.status_code == 404
    assert client.delete(f"/api/v1/child/tasks/{task['id']}", headers=child_headers).status_code == 404


@pytest.mark.parametrize('existing_history', [False, True])
def test_history_view_does_not_create_routines_or_break_streak(client, family, db_session, existing_history):
    headers, child_headers, child_id, plans = family
    assert client.get('/api/v1/child/today', headers=child_headers).status_code == 200
    yesterday = date.today() - timedelta(days=1)
    plan = db_session.get(Plan, UUID(plans[0]))
    plan.start_date = date.today() - timedelta(days=7)
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(child_id)))
    streak.current_days = streak.longest_days = 5
    streak.streak_updated_date = date.today() - timedelta(days=3)
    historical_task = None
    if existing_history:
        historical_task = DailyTask(
            child_id=UUID(child_id), plan_id=plan.id, task_date=yesterday,
            title='recorded history', status='completed', approved=True,
            created_at=datetime.combine(yesterday, time(12), UTC),
        )
        db_session.add(historical_task)
    db_session.commit()
    response = client.post(f'/api/v1/plans/{plans[0]}/task-templates', headers=headers,
                           json={'title': 'new routine', 'expected_minutes': 10})
    assert response.status_code == 201, response.text
    for _ in range(2):
        response = client.get(f'/api/v1/plans/{plans[0]}/daily-tasks', headers=headers,
                              params={'task_date': str(yesterday)})
        assert response.status_code == 200, response.text
        expected_ids = [str(historical_task.id)] if historical_task else []
        assert [task['id'] for task in response.json()['tasks']] == expected_ids
        assert response.json()['rewards']['current_streak_days'] == 5
    count = db_session.scalar(select(func.count()).select_from(DailyTask).where(
        DailyTask.child_id == UUID(child_id), DailyTask.task_date == yesterday,
    ))
    assert count == int(existing_history)
    today = client.get('/api/v1/child/today', headers=child_headers)
    assert today.status_code == 200, today.text
    assert len(today.json()['tasks']) == 1
    assert today.json()['tasks'][0]['title'] == 'new routine'
    response = client.patch(f"/api/v1/child/tasks/{today.json()['tasks'][0]['id']}/complete",
                            headers=child_headers, json={})
    assert response.status_code == 200, response.text
    assert response.json()['current_streak_days'] == 6


@pytest.mark.parametrize('assigned_total,assigned_done,expected_streak', [(0, 0, 5), (4, 4, 5), (4, 3, 0)])
def test_legacy_backfilled_tasks_do_not_change_historical_rate(
    client, family, db_session, assigned_total, assigned_done, expected_streak,
):
    headers, child_headers, child_id, plans = family
    assert client.get('/api/v1/child/today', headers=child_headers).status_code == 200
    yesterday = date.today() - timedelta(days=1)
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(child_id)))
    streak.current_days = streak.longest_days = 5
    streak.streak_updated_date = date.today() - timedelta(days=3)
    for i in range(assigned_total + 4):
        on_time = i < assigned_total
        db_session.add(DailyTask(
            child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=yesterday,
            title='historical fixture', approved=True,
            status='completed' if i < assigned_done else 'pending',
            created_at=datetime.combine(yesterday if on_time else date.today(), time(12), UTC),
        ))
    db_session.commit()
    task = create_task(client, headers, plans[0])
    response = client.get('/api/v1/child/today', headers=child_headers)
    assert response.status_code == 200, response.text
    assert response.json()['rewards']['current_streak_days'] == expected_streak
    response = client.patch(f"/api/v1/child/tasks/{task['id']}/complete", headers=child_headers, json={})
    assert response.status_code == 200, response.text
    assert response.json()['current_streak_days'] == expected_streak + 1
    db_session.refresh(streak)
    assert streak.longest_days == max(5, expected_streak + 1)


@pytest.mark.parametrize('created_next_day,expected_missed', [(False, True), (True, False)])
def test_historical_assignment_cutoff_uses_utc_not_database_session_timezone(
    family, db_session, created_next_day, expected_missed,
):
    _, _, child_id, plans = family
    yesterday = date.today() - timedelta(days=1)
    created_at = datetime.combine(date.today(), time.min, UTC) if created_next_day else datetime.combine(yesterday, time.max, UTC)
    db_session.add(DailyTask(
        child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=yesterday,
        title='UTC boundary fixture', status='pending', approved=True, created_at=created_at,
    ))
    db_session.commit()
    try:
        db_session.execute(text("SET LOCAL TIME ZONE 'America/Los_Angeles'"))
        assert _has_missed_task_day(db_session, UUID(child_id), yesterday - timedelta(days=1), date.today(), 80) is expected_missed
    finally:
        db_session.rollback()


@pytest.mark.parametrize('protection', ['none', 'vacation', 'frozen'])
@pytest.mark.parametrize('other_missed_day', [False, True])
def test_deleting_historical_surplus_recalculates_streak_and_keeps_real_breaks(
    client, family, db_session, other_missed_day, protection,
):
    headers, child_headers, child_id, plans = family
    assert client.get('/api/v1/child/today', headers=child_headers).status_code == 200
    today = date.today()
    extra = None
    for offset in [6, 3, 0]:
        day = today - timedelta(days=offset)
        db_session.add(DailyTask(
            child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=day,
            title='recorded completion', status='completed', approved=True,
            created_at=datetime.combine(day, time(12), UTC),
        ))
        if offset == 3:
            extra = DailyTask(
                child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=day,
                title='surplus pending', approved=True,
                created_at=datetime.combine(day, time(12), UTC),
            )
            db_session.add(extra)
    if other_missed_day:
        day = today - timedelta(days=1)
        db_session.add(DailyTask(
            child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=day,
            title='remaining missed day', approved=True,
            created_at=datetime.combine(day, time(12), UTC),
        ))
    if other_missed_day and protection == 'vacation':
        db_session.add(ChildVacation(child_id=UUID(child_id), start_date=day, end_date=day))
    if other_missed_day and protection == 'frozen':
        db_session.add(ChildStreakFreezeUsage(child_id=UUID(child_id), used_date=day))
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(child_id)))
    streak.current_days = 1
    streak.longest_days = 41
    streak.streak_updated_date = today
    db_session.commit()
    rewards_before = db_session.scalar(select(func.count()).select_from(RewardLedger))
    response = client.delete(f'/api/v1/plans/{plans[0]}/daily-tasks/{extra.id}', headers=headers)
    assert response.status_code == 204, response.text
    for _ in range(2):
        response = client.get('/api/v1/child/today', headers=child_headers)
        assert response.status_code == 200, response.text
        assert response.json()['rewards']['current_streak_days'] == (1 if other_missed_day and protection == 'none' else 3)
    db_session.refresh(streak)
    assert streak.longest_days == 41
    assert db_session.scalar(select(func.count()).select_from(RewardLedger)) == rewards_before
    assert db_session.scalar(select(func.count()).select_from(ChildStreakFreezeUsage).where(ChildStreakFreezeUsage.child_id == UUID(child_id))) == int(other_missed_day and protection == 'frozen')


@pytest.mark.parametrize('complete_before_summary', [False, True])
def test_summary_reconciles_deletions_made_before_fix_without_counting_unfinished_today(
    client, family, db_session, complete_before_summary,
):
    _, child_headers, child_id, plans = family
    assert client.get('/api/v1/child/today', headers=child_headers).status_code == 200
    today = date.today()
    for offset in [5, 2]:
        day = today - timedelta(days=offset)
        db_session.add(DailyTask(
            child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=day,
            title='historical completion', status='completed', approved=True,
            created_at=datetime.combine(day, time(12), UTC),
        ))
    yesterday = today - timedelta(days=1)
    db_session.add(DailyTask(
        child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=yesterday,
        title='previously deleted', status='deleted', approved=True,
        created_at=datetime.combine(yesterday, time(12), UTC), updated_at=datetime.now(UTC),
    ))
    today_task = DailyTask(
        child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=today,
        title='unfinished today', status='pending', approved=True,
    )
    db_session.add(today_task)
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(child_id)))
    streak.current_days = 0
    streak.longest_days = 41
    streak.streak_updated_date = today - timedelta(days=5)
    streak.updated_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.commit()
    if complete_before_summary:
        response = client.patch(f'/api/v1/child/tasks/{today_task.id}/complete', headers=child_headers, json={})
        assert response.status_code == 200, response.text
        assert response.json()['current_streak_days'] == 3
    for _ in range(2):
        response = client.get('/api/v1/child/today', headers=child_headers)
        assert response.status_code == 200, response.text
        assert response.json()['rewards']['current_streak_days'] == (3 if complete_before_summary else 2)
    db_session.refresh(streak)
    assert streak.streak_updated_date == (today if complete_before_summary else today - timedelta(days=2))
    assert streak.longest_days == 41


@pytest.mark.parametrize('invalid_date', ['', 'NaN-NaN-NaN', '2026-02-30'])
def test_invalid_history_date_is_rejected_without_creating_tasks(client, family, db_session, invalid_date):
    headers, _, child_id, plans = family
    before = db_session.scalar(select(func.count()).select_from(DailyTask).where(DailyTask.child_id == UUID(child_id)))
    response = client.get(f'/api/v1/plans/{plans[0]}/daily-tasks', headers=headers, params={'task_date': invalid_date})
    assert response.status_code == 422
    assert db_session.scalar(select(func.count()).select_from(DailyTask).where(DailyTask.child_id == UUID(child_id))) == before


@pytest.mark.parametrize('retroactive', [False, True])
def test_deleting_ineligible_history_preserves_existing_legacy_credit(client, family, db_session, retroactive):
    headers, child_headers, child_id, plans = family
    assert client.get('/api/v1/child/today', headers=child_headers).status_code == 200
    yesterday = date.today() - timedelta(days=1)
    task = DailyTask(
        child_id=UUID(child_id), plan_id=UUID(plans[0]), task_date=yesterday,
        title='ineligible history', approved=retroactive,
        created_at=datetime.combine(date.today() if retroactive else yesterday, time(12), UTC),
    )
    db_session.add(task)
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(child_id)))
    streak.current_days = streak.longest_days = 5
    streak.streak_updated_date = yesterday - timedelta(days=1)
    db_session.commit()
    assert client.delete(f'/api/v1/plans/{plans[0]}/daily-tasks/{task.id}', headers=headers).status_code == 204
    response = client.get('/api/v1/child/today', headers=child_headers)
    assert response.status_code == 200, response.text
    assert response.json()['rewards']['current_streak_days'] == 5
