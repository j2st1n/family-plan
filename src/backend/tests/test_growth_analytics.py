from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from app.models.daily_task import DailyTask
from app.models.reward_ledger import RewardLedger
from app.models.child_device import ChildDevice
from app.models.child_vacation import ChildVacation
from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.services.analytics import classify_task_category
from test_sprint3_vacation_freeze_analytics import _create_user_and_child


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_growth_device_scope_and_parent_projection(client, db_session):
    parent, device, cid, plan = _create_user_and_child(client, "growth")
    _, other_device, other_id, _ = _create_user_and_child(client, "othergrowth")
    today = date.today()
    db_session.add_all([
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today, title="私密任务", description="[体育运动]", approved=True, status="completed", actual_seconds=125),
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today, title="未计时完成", approved=True, status="completed"),
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today, title="等待家长", approved=True, status="submitted", actual_seconds=999),
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today, title="删除", approved=True, status="deleted", actual_seconds=999),
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today, title="未审核提议", approved=False, status="completed", actual_seconds=999),
        DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today-timedelta(days=8), title="范围之外", approved=True, status="completed", actual_seconds=999),
        RewardLedger(child_id=UUID(cid), source_type="daily_task", source_id=uuid4(), stars_delta=Decimal("1.25"), reason="私密流水"),
        RewardLedger(child_id=UUID(cid), source_type="shop", source_id=uuid4(), stars_delta=Decimal("-0.50"), reason="synthetic debit"),
        RewardLedger(child_id=UUID(cid), source_type="daily_task", source_id=uuid4(), stars_delta=Decimal("10.00"), reason="synthetic old", created_at=datetime.combine(today-timedelta(days=8), time.min, tzinfo=UTC)),
        RewardLedger(child_id=UUID(cid), source_type="daily_task", source_id=uuid4(), stars_delta=Decimal("20.00"), reason="synthetic future", created_at=datetime.combine(today+timedelta(days=1), time.min, tzinfo=UTC)),
    ])
    db_session.commit()
    child = client.get("/api/v1/child/analytics?days=7", headers=auth(device))
    assert child.status_code == 200, child.text
    data = child.json()
    assert data["summary"] == {"total_tasks": 3, "completed_tasks": 2, "qualified_days": 0, "task_days": 1, "recorded_tasks": 1, "actual_seconds": 125}
    assert Decimal(data["stars_earned"]) == Decimal("1.25")
    assert not any(key in data for key in ["child_id", "insights", "current_stars", "attention_needed"])
    assert "私密任务" not in child.text and "私密流水" not in child.text
    parent_data = client.get(f"/api/v1/plans/children/{cid}/analytics?days=7", headers=auth(parent)).json()
    for key in ["summary", "heatmap", "categories", "days", "start_date", "end_date"]:
        assert data[key] == parent_data[key]
    assert data["streak"] == parent_data["insights"]["streak"]
    assert data["stars_earned"] == parent_data["insights"]["stars"]["stars_earned"]
    # A child-supplied ID cannot select another account; only the binding is used.
    other = client.get(f"/api/v1/child/analytics?days=7&child_id={cid}", headers=auth(other_device)).json()
    assert other["summary"]["completed_tasks"] == 0
    assert other["child_name"] != data["child_name"]
    assert client.get(f"/api/v1/plans/children/{other_id}/analytics", headers=auth(parent)).status_code == 404
    assert client.get(f"/api/v1/plans/children/{cid}/analytics", headers=auth(device)).status_code == 401
    assert client.get("/api/v1/child/analytics", headers=auth(parent)).status_code == 401
    assert client.get("/api/v1/child/analytics").status_code == 401
    for span in ["0", "366", "nope"]:
        assert client.get(f"/api/v1/child/analytics?days={span}", headers=auth(device)).status_code == 422
    assert client.get("/api/v1/child/analytics?days=90", headers=auth(device)).json()["days"] == 90
    from sqlalchemy import select
    from app.core.security import hash_secret
    record = db_session.scalar(select(ChildDevice).where(ChildDevice.device_token_hash == hash_secret(device)))
    record.revoked_at = datetime.now(UTC); db_session.commit()
    assert client.get("/api/v1/child/analytics", headers=auth(device)).status_code == 401


def test_growth_rest_exemptions_and_untimed_zero(client, db_session):
    _, device, cid, plan = _create_user_and_child(client, "restgrowth")
    today = date.today()
    for days, status, seconds in [(0, "completed", 0), (1, "completed", None), (2, "pending", None), (3, "pending", None)]:
        db_session.add(DailyTask(child_id=UUID(cid), plan_id=UUID(plan), task_date=today-timedelta(days=days), title="刷牙", approved=True, status=status, actual_seconds=seconds))
    db_session.add(ChildVacation(child_id=UUID(cid), start_date=today-timedelta(days=2), end_date=today-timedelta(days=2)))
    db_session.add(ChildStreakFreezeUsage(child_id=UUID(cid), used_date=today-timedelta(days=3), reason="test"))
    db_session.commit()
    result = client.get("/api/v1/child/analytics?days=7", headers=auth(device)).json()
    assert result["summary"]["qualified_days"] == 2
    assert result["summary"]["recorded_tasks"] == 1
    assert result["summary"]["actual_seconds"] == 0
    assert [x["status"] for x in result["heatmap"]].count("rest") == 3
    assert {x["status"] for x in result["heatmap"]} == {"rest", "perfect", "vacation", "frozen"}
    assert classify_task_category("阅读跑步", "[家务协助]") == "家务协助"
