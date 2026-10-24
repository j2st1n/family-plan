from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.ratelimit import auth_limiter
from app.models.daily_task import DailyTask


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


@pytest.mark.parametrize('stars', [0, 2, 5])
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
