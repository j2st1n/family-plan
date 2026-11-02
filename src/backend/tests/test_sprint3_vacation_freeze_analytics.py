from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.models.child_streak_freeze import ChildStreakFreeze
from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.models.child_vacation import ChildVacation
from app.models.daily_task import DailyTask
from app.models.reward_ledger import RewardLedger
from app.models.streak import Streak
from app.services.analytics import classify_task_category, get_child_analytics
from app.services.daily_tasks import _get_or_create_streak, _has_missed_task_day, get_reward_summary
from app.services.streak_freeze import (
    consume_freeze_for_date,
    get_or_create_streak_freeze,
    purchase_streak_freeze,
)
from app.services.vacations import is_child_on_vacation


def _create_user_and_child(client, prefix: str = "sp3"):
    pw, un = "pass12345678", f"{prefix}_{uuid4().hex[:8]}"
    auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
    assert auth.status_code == 201, auth.text
    token = auth.json()["token"]

    child = client.post(
        "/api/v1/children",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": f"Child_{prefix}", "grade_label": "三年级"},
    )
    assert child.status_code in (200, 201), child.text
    cid = child.json()["id"]

    code = client.post(
        f"/api/v1/children/{cid}/access-code",
        headers={"Authorization": f"Bearer {token}"},
    ).json()["code"]

    dev = client.post(
        "/api/v1/child-devices/bind",
        json={"code": code, "display_name": "Test iPad"},
    )
    assert dev.status_code in (200, 201), dev.text
    dtoken = dev.json()["device_token"]

    plan = client.post(
        "/api/v1/plans",
        headers={"Authorization": f"Bearer {token}"},
        json={"child_id": cid, "title": "Main Plan", "start_date": "2026-05-01"},
    )
    assert plan.status_code == 201, plan.text
    plan_id = plan.json()["id"]

    return token, dtoken, cid, plan_id


class TestVacationMode:
    def test_vacation_crud_and_validation(self, client):
        token, _dtoken, cid, _plan_id = _create_user_and_child(client, "vac1")
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Invalid date range (start > end)
        res = client.post(
            f"/api/v1/plans/children/{cid}/vacations",
            headers=headers,
            json={
                "start_date": "2026-07-10",
                "end_date": "2026-07-05",
                "reason": "Invalid",
            },
        )
        assert res.status_code in (400, 422)

        # 2. Create valid vacation
        res = client.post(
            f"/api/v1/plans/children/{cid}/vacations",
            headers=headers,
            json={
                "start_date": "2026-07-01",
                "end_date": "2026-07-07",
                "reason": "Summer Camp",
            },
        )
        assert res.status_code == 201
        vac = res.json()
        assert vac["reason"] == "Summer Camp"
        vac_id = vac["id"]

        # 3. List vacations
        res = client.get(f"/api/v1/plans/children/{cid}/vacations", headers=headers)
        assert res.status_code == 200
        vacations = res.json()
        assert len(vacations) == 1
        assert vacations[0]["id"] == vac_id

        # 4. Delete vacation
        res = client.delete(f"/api/v1/plans/children/{cid}/vacations/{vac_id}", headers=headers)
        assert res.status_code == 204

        # 5. List vacations again
        res = client.get(f"/api/v1/plans/children/{cid}/vacations", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) == 0

    def test_vacation_exempts_missed_tasks_and_preserves_streak(self, client, db_session):
        print("STEP 1: create child", flush=True)
        token, dtoken, cid, plan_id = _create_user_and_child(client, "vac2")
        headers = {"Authorization": f"Bearer {token}"}
        child_headers = {"Authorization": f"Bearer {dtoken}"}

        print("STEP 2: streak setup", flush=True)
        # Set streak to 5
        streak = _get_or_create_streak(db_session, UUID(cid))
        streak.current_days = 5
        streak.longest_days = 5
        streak.streak_updated_date = date.today() - timedelta(days=3)
        db_session.commit()

        missed_day = date.today() - timedelta(days=1)

        print("STEP 3: add task", flush=True)
        # Add an approved task yesterday that was NOT completed
        db_session.add(
            DailyTask(
                child_id=UUID(cid),
                plan_id=UUID(plan_id),
                task_date=missed_day,
                title="Math Homework",
                reward_stars=1,
                approved=True,
                status="pending",
            )
        )
        db_session.commit()

        print("STEP 4: client post vacation", flush=True)
        # Add vacation covering yesterday (cross-date closed interval)
        client.post(
            f"/api/v1/plans/children/{cid}/vacations",
            headers=headers,
            json={
                "start_date": (missed_day - timedelta(days=1)).isoformat(),
                "end_date": missed_day.isoformat(),
                "reason": "Family vacation",
            },
        )

        print("STEP 5: get_reward_summary", flush=True)
        # Check reward summary: streak should NOT break because yesterday is in vacation
        summary = get_reward_summary(db_session, UUID(cid))
        assert summary["current_streak_days"] == 5
        db_session.commit()

        print("STEP 6: client get today", flush=True)
        # Check API
        today_res = client.get("/api/v1/child/today", headers=child_headers)
        assert today_res.status_code == 200
        assert today_res.json()["rewards"]["current_streak_days"] == 5


class TestStreakFreeze:
    def test_monthly_grant_logic(self, client, db_session):
        _token, _dtoken, cid, _plan_id = _create_user_and_child(client, "grnt")
        child_id = UUID(cid)
        freeze = get_or_create_streak_freeze(db_session, child_id)
        assert freeze.available_count == 0
        current_month = date.today().strftime("%Y-%m")
        assert freeze.last_granted_month == current_month

        # Simulate previous month
        freeze.last_granted_month = "2026-10"
        db_session.commit()

        # When checked in current month (2026-11), it should grant 1 card automatically
        freeze_after = get_or_create_streak_freeze(db_session, child_id)
        assert freeze_after.available_count == 1
        assert freeze_after.last_granted_month == current_month

    def test_shop_purchase_freeze_and_insufficient_stars(self, client, db_session):
        token, dtoken, cid, _plan_id = _create_user_and_child(client, "frz1")
        child_headers = {"Authorization": f"Bearer {dtoken}"}
        parent_headers = {"Authorization": f"Bearer {token}"}

        # 1. Initially 0 freeze cards and 0 stars -> purchase should 409
        res = client.post("/api/v1/child/shop/freeze/purchase", headers=child_headers)
        assert res.status_code == 409

        # 2. Add 10 stars via RewardLedger
        db_session.add(
            RewardLedger(
                child_id=UUID(cid),
                source_type="daily_task",
                source_id=uuid4(),
                stars_delta=Decimal("10.00"),
                reason="Excellent performance",
            )
        )
        db_session.commit()

        # 3. Check child freeze query API
        res = client.get("/api/v1/child/shop/freeze", headers=child_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["available_count"] == 0
        assert data["can_purchase"] is True
        assert Decimal(str(data["star_cost"])) == Decimal("5.00")

        # 4. Purchase 1 freeze card
        res = client.post("/api/v1/child/shop/freeze/purchase", headers=child_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["available_count"] == 1

        # 5. Parent can also query child freeze
        res = client.get(f"/api/v1/shop/children/{cid}/freeze", headers=parent_headers)
        assert res.status_code == 200
        assert res.json()["available_count"] == 1

    def test_auto_deduct_freeze_on_missed_day(self, client, db_session):
        _token, dtoken, cid, plan_id = _create_user_and_child(client, "frz2")
        child_headers = {"Authorization": f"Bearer {dtoken}"}

        # Setup streak = 7
        streak = _get_or_create_streak(db_session, UUID(cid))
        streak.current_days = 7
        streak.longest_days = 7
        streak.streak_updated_date = date.today() - timedelta(days=2)

        # Grant 1 freeze card
        freeze = get_or_create_streak_freeze(db_session, UUID(cid))
        freeze.available_count = 1
        db_session.commit()

        # Yesterday had an approved task that was NOT completed
        yesterday = date.today() - timedelta(days=1)
        db_session.add(
            DailyTask(
                child_id=UUID(cid),
                plan_id=UUID(plan_id),
                task_date=yesterday,
                title="Morning Reading",
                reward_stars=1,
                approved=True,
                status="pending",
            )
        )
        db_session.commit()

        # Fetch child today: freeze card should be automatically consumed, saving streak!
        res = client.get("/api/v1/child/today", headers=child_headers)
        assert res.status_code == 200
        rewards = res.json()["rewards"]
        assert rewards["current_streak_days"] == 7
        assert rewards["streak_freeze_count"] == 0

        # Verify usage record exists
        usage = db_session.scalar(
            select(ChildStreakFreezeUsage).where(
                ChildStreakFreezeUsage.child_id == UUID(cid),
                ChildStreakFreezeUsage.used_date == yesterday,
            )
        )
        assert usage is not None

        # Another missed day without available freeze cards breaks streak to 0
        db_session.add(
            DailyTask(
                child_id=UUID(cid),
                plan_id=UUID(plan_id),
                task_date=date.today() - timedelta(days=3),
                title="Science Project",
                reward_stars=1,
                approved=True,
                status="pending",
            )
        )
        streak.streak_updated_date = date.today() - timedelta(days=4)
        db_session.commit()

        summary = get_reward_summary(db_session, UUID(cid))
        assert summary["current_streak_days"] == 0


class TestAnalyticsAPI:
    def test_empty_child_analytics_zero_division_safety(self, client):
        token, _dtoken, cid, _plan_id = _create_user_and_child(client, "ana1")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get(f"/api/v1/plans/children/{cid}/analytics?days=30", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["days"] == 30
        assert len(data["heatmap"]) == 30
        # All days should be 'rest' since no tasks exist
        for item in data["heatmap"]:
            assert item["status"] == "rest"
            assert item["completion_rate"] == 0
            assert item["total_tasks"] == 0

        # All 4 categories must be present
        assert len(data["categories"]) == 4
        cat_names = {c["category"] for c in data["categories"]}
        assert cat_names == {"学习思考", "体育运动", "生活自理", "家务协助"}
        for c in data["categories"]:
            assert c["completion_rate"] == 0
            assert c["total_tasks"] == 0

        # Insights handles empty data gracefully
        assert data["insights"]["best_habit"] is None
        assert data["insights"]["attention_needed"] is None
        assert data["insights"]["streak"]["current_streak_days"] == 0

    def test_analytics_with_rich_task_data_and_statuses(self, client, db_session):
        token, _dtoken, cid, plan_id = _create_user_and_child(client, "ana2")
        headers = {"Authorization": f"Bearer {token}"}
        today = date.today()

        # Day 1 (today): 2 tasks, both completed -> perfect
        t1 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=today,
            title="语文课文背诵",
            reward_stars=2,
            approved=True,
            status="completed",
        )
        t2 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=today,
            title="跳绳500个",
            reward_stars=1,
            approved=True,
            status="completed",
        )

        # Day 2 (yesterday): 2 tasks, 1 completed (50%) -> qualified if threshold=50
        day_yesterday = today - timedelta(days=1)
        t3 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=day_yesterday,
            title="早晚刷牙洗脸",
            reward_stars=1,
            approved=True,
            status="completed",
        )
        t4 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=day_yesterday,
            title="帮忙洗碗扫地",
            reward_stars=1,
            approved=True,
            status="pending",
        )

        # Day 3 (2 days ago): 2 tasks, 0 completed -> frozen (via freeze card usage)
        day_frozen = today - timedelta(days=2)
        t5 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=day_frozen,
            title="英语单词默写",
            reward_stars=1,
            approved=True,
            status="pending",
        )
        freeze_usage = ChildStreakFreezeUsage(
            child_id=UUID(cid),
            used_date=day_frozen,
            reason="auto_deduct_missed_day",
        )

        # Day 4 (3 days ago): vacation
        day_vacation = today - timedelta(days=3)
        vacation = ChildVacation(
            child_id=UUID(cid),
            start_date=day_vacation,
            end_date=day_vacation,
            reason="Trip",
        )

        # Day 5 (4 days ago): 2 tasks, 0 completed -> missed
        day_missed = today - timedelta(days=4)
        t6 = DailyTask(
            child_id=UUID(cid),
            plan_id=UUID(plan_id),
            task_date=day_missed,
            title="数学口算练习",
            reward_stars=1,
            approved=True,
            status="pending",
        )

        db_session.add_all([t1, t2, t3, t4, t5, freeze_usage, vacation, t6])
        db_session.commit()

        # Query analytics for 7 days
        res = client.get(f"/api/v1/plans/children/{cid}/analytics?days=7", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["days"] == 7
        assert len(data["heatmap"]) == 7

        heatmap_by_date = {h["date"]: h for h in data["heatmap"]}

        # Check statuses
        assert heatmap_by_date[today.isoformat()]["status"] == "perfect"
        assert heatmap_by_date[day_yesterday.isoformat()]["status"] in ("qualified", "missed")
        assert heatmap_by_date[day_frozen.isoformat()]["status"] == "frozen"
        assert heatmap_by_date[day_vacation.isoformat()]["status"] == "vacation"
        assert heatmap_by_date[day_missed.isoformat()]["status"] == "missed"

        # Check category performance
        cats = {c["category"]: c for c in data["categories"]}
        assert "学习思考" in cats
        assert "体育运动" in cats
        assert "生活自理" in cats
        assert "家务协助" in cats
        assert cats["体育运动"]["completed_tasks"] >= 1
        assert cats["生活自理"]["completed_tasks"] >= 1

        # Check insights
        assert data["insights"]["best_habit"] is not None
        assert data["insights"]["attention_needed"] is not None
