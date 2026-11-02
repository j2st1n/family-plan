from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.ratelimit import auth_limiter
from app.models.child import Child
from app.models.daily_task import DailyTask
from app.models.parent import Parent
from app.models.plan import Plan
from app.models.reward_ledger import RewardLedger
from app.models.streak import Streak
from app.models.task_template import TaskTemplate
from app.services.event_hub import event_hub


@pytest.fixture
def auth_family(client):
    auth_limiter._global._buckets.clear()
    parent_pw = "pass12345"
    parent_un = "parent_" + uuid4().hex[:8]
    auth_resp = client.post("/api/v1/auth/register", json={"username": parent_un, "password": parent_pw})
    assert auth_resp.status_code == 201, auth_resp.text
    token = auth_resp.json()["token"]
    parent_id = auth_resp.json()["parent"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    child_resp = client.post("/api/v1/children", headers=headers, json={"name": "test-kid"})
    assert child_resp.status_code == 200, child_resp.text
    child_id = child_resp.json()["id"]

    code_resp = client.post(f"/api/v1/children/{child_id}/access-code", headers=headers)
    assert code_resp.status_code == 200, code_resp.text
    code = code_resp.json()["code"]

    bind_resp = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "kid-pad"})
    assert bind_resp.status_code == 200, bind_resp.text
    child_token = bind_resp.json()["device_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    plan_resp = client.post(
        "/api/v1/plans",
        headers=headers,
        json={"child_id": child_id, "title": "Main Plan", "start_date": str(date.today())},
    )
    assert plan_resp.status_code == 201, plan_resp.text
    plan_id = plan_resp.json()["id"]

    return {
        "parent_token": token,
        "parent_id": parent_id,
        "parent_headers": headers,
        "child_id": child_id,
        "child_token": child_token,
        "child_headers": child_headers,
        "plan_id": plan_id,
    }


def test_model_columns_exist():
    assert hasattr(DailyTask, "require_approval")
    assert hasattr(DailyTask, "submitted_at")
    assert hasattr(TaskTemplate, "require_approval")


def test_complete_task_with_require_approval_transitions_to_submitted(client, auth_family, db_session):
    fam = auth_family
    # 1. Create task with require_approval=True
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [
                {
                    "title": "Clean Bedroom",
                    "expected_minutes": 20,
                    "reward_stars": 3,
                    "require_approval": True,
                }
            ],
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    task_id = create_resp.json()[0]["id"]
    assert create_resp.json()[0]["require_approval"] is True
    assert create_resp.json()[0]["status"] == "pending"

    # Track published events
    events = []
    orig_publish = event_hub.publish

    def mock_publish(parent_id, topic, reason, child_id=None):
        events.append((parent_id, topic, reason, child_id))
        return orig_publish(parent_id, topic, reason, child_id)

    event_hub.publish = mock_publish
    try:
        # 2. Child completes the task
        comp_resp = client.patch(
            f"/api/v1/child/tasks/{task_id}/complete",
            headers=fam["child_headers"],
            json={"feedback": "done!"},
        )
        assert comp_resp.status_code == 200, comp_resp.text
        data = comp_resp.json()
        assert data["task_id"] == task_id
        assert data["status"] == "submitted"
        assert data["stars_awarded"] == 0

        # DB check: task status is submitted, submitted_at is set, completed_at is None
        task = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task_id)))
        assert task.status == "submitted"
        assert task.submitted_at is not None
        assert task.completed_at is None

        # Stars NOT awarded in RewardLedger
        ledger = db_session.scalar(
            select(RewardLedger).where(
                RewardLedger.source_type == "daily_task",
                RewardLedger.source_id == UUID(task_id),
            )
        )
        assert ledger is None

        # Event published is task_submitted
        assert any(e[1] == "tasks" and e[2] == "task_submitted" for e in events)

        # 3. Duplicate complete attempt by child returns 409
        dup_resp = client.patch(
            f"/api/v1/child/tasks/{task_id}/complete",
            headers=fam["child_headers"],
            json={"feedback": "again"},
        )
        assert dup_resp.status_code == 409
    finally:
        event_hub.publish = orig_publish


def test_complete_task_without_require_approval_direct_completion(client, auth_family, db_session):
    fam = auth_family
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [
                {
                    "title": "Quick Drink Water",
                    "expected_minutes": 5,
                    "reward_stars": 1,
                    "require_approval": False,
                }
            ],
        },
    )
    assert create_resp.status_code == 201
    task_id = create_resp.json()[0]["id"]
    assert create_resp.json()[0]["require_approval"] is False

    events = []
    orig_publish = event_hub.publish

    def mock_publish(parent_id, topic, reason, child_id=None):
        events.append((parent_id, topic, reason, child_id))
        return orig_publish(parent_id, topic, reason, child_id)

    event_hub.publish = mock_publish
    try:
        comp_resp = client.patch(
            f"/api/v1/child/tasks/{task_id}/complete",
            headers=fam["child_headers"],
            json={"feedback": "slurp"},
        )
        assert comp_resp.status_code == 200
        data = comp_resp.json()
        assert data["status"] == "completed"
        assert data["stars_awarded"] == 1

        task = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task_id)))
        assert task.status == "completed"
        assert task.completed_at is not None

        ledger = db_session.scalar(
            select(RewardLedger).where(
                RewardLedger.source_type == "daily_task",
                RewardLedger.source_id == UUID(task_id),
            )
        )
        assert ledger is not None
        assert ledger.stars_delta == Decimal("1.00")
        assert any(e[1] == "tasks" and e[2] == "task_completed" for e in events)
    finally:
        event_hub.publish = orig_publish


def test_parent_approve_reject_revoke_lifecycle(client, auth_family, db_session):
    fam = auth_family
    # 1. Create require_approval task
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [
                {"title": "Math Practice", "expected_minutes": 25, "reward_stars": 2, "require_approval": True}
            ],
        },
    )
    task_id = create_resp.json()[0]["id"]

    # Child submits it
    client.patch(
        f"/api/v1/child/tasks/{task_id}/complete",
        headers=fam["child_headers"],
        json={"feedback": "math done"},
    )

    # Cannot approve non-submitted task or reject non-submitted
    # But now it IS submitted: parent approves it
    events = []
    orig_publish = event_hub.publish

    def mock_publish(parent_id, topic, reason, child_id=None):
        events.append((parent_id, topic, reason, child_id))
        return orig_publish(parent_id, topic, reason, child_id)

    event_hub.publish = mock_publish
    try:
        approve_resp = client.post(
            f"/api/v1/plans/tasks/{task_id}/approve",
            headers=fam["parent_headers"],
        )
        assert approve_resp.status_code == 200, approve_resp.text
        assert approve_resp.json()["status"] == "completed"

        task = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task_id)))
        assert task.status == "completed"
        assert task.completed_at is not None

        # Ledger now has stars
        ledger = db_session.scalar(
            select(RewardLedger).where(
                RewardLedger.source_type == "daily_task",
                RewardLedger.source_id == UUID(task_id),
            )
        )
        assert ledger is not None
        assert ledger.stars_delta == Decimal("2.00")
        assert any(e[1] == "tasks" and e[2] == "task_approved" for e in events)

        # Approving again should 409 conflict
        dup_approve = client.post(
            f"/api/v1/plans/tasks/{task_id}/approve",
            headers=fam["parent_headers"],
        )
        assert dup_approve.status_code == 409

        # Revoke completed task
        events.clear()
        revoke_resp = client.post(
            f"/api/v1/plans/tasks/{task_id}/revoke",
            headers=fam["parent_headers"],
        )
        assert revoke_resp.status_code == 200, revoke_resp.text
        assert revoke_resp.json()["status"] == "pending"

        db_session.expire_all()
        task = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task_id)))
        assert task.status == "pending"
        assert task.completed_at is None
        assert task.submitted_at is None

        # Ledger entry deleted
        ledger = db_session.scalar(
            select(RewardLedger).where(
                RewardLedger.source_type == "daily_task",
                RewardLedger.source_id == UUID(task_id),
            )
        )
        assert ledger is None
        assert any(e[1] == "tasks" and e[2] == "task_revoked" for e in events)

        # Child submits again
        client.patch(
            f"/api/v1/child/tasks/{task_id}/complete",
            headers=fam["child_headers"],
            json={"feedback": "resubmitted"},
        )

        # Parent rejects this time
        events.clear()
        reject_resp = client.post(
            f"/api/v1/plans/tasks/{task_id}/reject",
            headers=fam["parent_headers"],
        )
        assert reject_resp.status_code == 200, reject_resp.text
        assert reject_resp.json()["status"] == "pending"

        db_session.expire_all()
        task = db_session.scalar(select(DailyTask).where(DailyTask.id == UUID(task_id)))
        assert task.status == "pending"
        assert task.submitted_at is None
        assert any(e[1] == "tasks" and e[2] == "task_rejected" for e in events)
    finally:
        event_hub.publish = orig_publish


def test_parent_permission_isolation(client, auth_family):
    fam = auth_family
    # Create a task under fam
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [{"title": "Private Task", "expected_minutes": 10, "reward_stars": 1, "require_approval": True}],
        },
    )
    task_id = create_resp.json()[0]["id"]
    client.patch(f"/api/v1/child/tasks/{task_id}/complete", headers=fam["child_headers"], json={})

    # Register an attacker/different parent
    auth_resp2 = client.post("/api/v1/auth/register", json={"username": "other_" + uuid4().hex[:8], "password": "pass12345"})
    assert auth_resp2.status_code == 201
    other_headers = {"Authorization": f"Bearer {auth_resp2.json()['token']}"}

    # Other parent cannot approve, reject, or revoke
    assert client.post(f"/api/v1/plans/tasks/{task_id}/approve", headers=other_headers).status_code == 404
    assert client.post(f"/api/v1/plans/tasks/{task_id}/reject", headers=other_headers).status_code == 404
    assert client.post(f"/api/v1/plans/tasks/{task_id}/revoke", headers=other_headers).status_code == 404


def test_task_template_require_approval_propagation(client, auth_family):
    fam = auth_family
    # Create routine template with require_approval=True
    tpl_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/task-templates",
        headers=fam["parent_headers"],
        json={
            "title": "Daily Reading",
            "expected_minutes": 15,
            "reward_stars": 2,
            "weekdays": [1, 2, 3, 4, 5, 6, 7],
            "require_approval": True,
        },
    )
    assert tpl_resp.status_code == 201, tpl_resp.text
    assert tpl_resp.json()["require_approval"] is True

    # Fetch daily tasks for today
    tasks_resp = client.get(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        params={"task_date": str(date.today())},
    )
    assert tasks_resp.status_code == 200
    matched = [t for t in tasks_resp.json()["tasks"] if t["title"] == "Daily Reading"]
    assert len(matched) == 1
    assert matched[0]["require_approval"] is True


def test_invalid_status_transitions_and_mutations(client, auth_family, db_session):
    fam = auth_family
    # Create a task with require_approval=True
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [{"title": "Science Project", "expected_minutes": 30, "reward_stars": 3, "require_approval": True}],
        },
    )
    assert create_resp.status_code == 201
    task_id = create_resp.json()[0]["id"]

    # 1. State: pending
    # Cannot approve or reject or revoke a pending task
    assert client.post(f"/api/v1/plans/tasks/{task_id}/approve", headers=fam["parent_headers"]).status_code == 409
    assert client.post(f"/api/v1/plans/tasks/{task_id}/reject", headers=fam["parent_headers"]).status_code == 409
    assert client.post(f"/api/v1/plans/tasks/{task_id}/revoke", headers=fam["parent_headers"]).status_code == 409

    # 2. State transition: pending -> submitted
    sub_resp = client.patch(f"/api/v1/child/tasks/{task_id}/complete", headers=fam["child_headers"], json={})
    assert sub_resp.status_code == 200

    # In submitted state: cannot edit or delete the task
    edit_resp = client.patch(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks/{task_id}",
        headers=fam["parent_headers"],
        json={"title": "Hacked Title", "expected_minutes": 10, "reward_stars": 5},
    )
    assert edit_resp.status_code == 409
    assert "Cannot edit submitted task" in edit_resp.text

    del_resp = client.delete(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks/{task_id}",
        headers=fam["parent_headers"],
    )
    assert del_resp.status_code == 409
    assert "Cannot delete submitted task" in del_resp.text

    # Cannot revoke a submitted task
    assert client.post(f"/api/v1/plans/tasks/{task_id}/revoke", headers=fam["parent_headers"]).status_code == 409

    # 3. Child token or unauthenticated cannot approve/reject/revoke
    assert client.post(f"/api/v1/plans/tasks/{task_id}/approve", headers=fam["child_headers"]).status_code == 401
    assert client.post(f"/api/v1/plans/tasks/{task_id}/reject", headers=fam["child_headers"]).status_code == 401
    assert client.post(f"/api/v1/plans/tasks/{task_id}/revoke", headers=fam["child_headers"]).status_code == 401
    assert client.post(f"/api/v1/plans/tasks/{task_id}/approve").status_code == 401


def test_revoke_resyncs_streak_and_last_completed_date(client, auth_family, db_session):
    fam = auth_family
    # Create 1 task so completing it reaches 100% >= 80% streak threshold
    create_resp = client.post(
        f"/api/v1/plans/{fam['plan_id']}/daily-tasks",
        headers=fam["parent_headers"],
        json={
            "task_date": str(date.today()),
            "tasks": [
                {"title": "Task A", "expected_minutes": 10, "reward_stars": 1, "require_approval": True},
            ],
        },
    )
    assert create_resp.status_code == 201
    t_a_id = create_resp.json()[0]["id"]

    # Child submits Task A
    client.patch(f"/api/v1/child/tasks/{t_a_id}/complete", headers=fam["child_headers"], json={})
    # Parent approves Task A
    client.post(f"/api/v1/plans/tasks/{t_a_id}/approve", headers=fam["parent_headers"])

    # Verify streak is 1, last_completed_date is today
    db_session.expire_all()
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(fam["child_id"])))
    assert streak.current_days == 1
    assert streak.last_completed_date == date.today()

    # Now revoke Task A
    client.post(f"/api/v1/plans/tasks/{t_a_id}/revoke", headers=fam["parent_headers"])

    db_session.expire_all()
    streak = db_session.scalar(select(Streak).where(Streak.child_id == UUID(fam["child_id"])))
    assert streak.current_days == 0
    assert streak.streak_updated_date is None
    # Because there are no other completed tasks, last_completed_date must be None (re-synced!)
    assert streak.last_completed_date is None

