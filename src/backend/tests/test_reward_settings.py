from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text

from app.models.redemption import Redemption
from app.models.reward_ledger import RewardLedger
from app.services.reward_settings import calculate_discounted_star_cost


def _register_parent(client):
    username = "rs" + uuid4().hex[:8]
    response = client.post("/api/v1/auth/register", json={"username": username, "password": "pass12345"})
    assert response.status_code == 201
    return response.json()["token"]


def _create_child(client, token):
    response = client.post("/api/v1/children", headers={"Authorization": f"Bearer {token}"}, json={"name": "reward-child"})
    assert response.status_code == 200
    return response.json()["id"]


def _bind_child(client, token, child_id):
    code = client.post(f"/api/v1/children/{child_id}/access-code", headers={"Authorization": f"Bearer {token}"}).json()["code"]
    response = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "ipad"})
    assert response.status_code == 200
    return response.json()["device_token"]


def _create_plan(client, token, child_id):
    response = client.post(
        "/api/v1/plans",
        headers={"Authorization": f"Bearer {token}"},
        json={"child_id": child_id, "title": "reward-plan", "start_date": str(date.today())},
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestRewardSettings:
    def test_default_reward_settings(self, client):
        token = _register_parent(client)
        child_id = _create_child(client, token)

        response = client.get(f"/api/v1/children/{child_id}/reward-settings", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        assert response.json() == {
            "child_id": child_id,
            "streak_threshold": 80,
            "streak_discount_enabled": True,
            "streak_discount_tiers": [
                {"days": 7, "discount_percent": 90},
                {"days": 14, "discount_percent": 85},
                {"days": 21, "discount_percent": 80},
            ],
        }

    def test_update_reward_settings_validates_tiers(self, client):
        token = _register_parent(client)
        child_id = _create_child(client, token)

        invalid = client.patch(
            f"/api/v1/children/{child_id}/reward-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "streak_threshold": 80,
                "streak_discount_enabled": True,
                "streak_discount_tiers": [
                    {"days": 7, "discount_percent": 80},
                    {"days": 14, "discount_percent": 85},
                    {"days": 21, "discount_percent": 90},
                ],
            },
        )
        assert invalid.status_code == 422

        valid = client.patch(
            f"/api/v1/children/{child_id}/reward-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "streak_threshold": 70,
                "streak_discount_enabled": True,
                "streak_discount_tiers": [
                    {"days": 7, "discount_percent": 95},
                    {"days": 14, "discount_percent": 90},
                    {"days": 21, "discount_percent": 75},
                ],
            },
        )
        assert valid.status_code == 200
        assert valid.json()["streak_threshold"] == 70
        assert valid.json()["streak_discount_tiers"][2]["discount_percent"] == 75

    def test_discount_calculation_decimal_precision(self):
        assert calculate_discounted_star_cost(Decimal("10.00"), 85) == Decimal("8.50")
        assert calculate_discounted_star_cost(Decimal("3.00"), 85) == Decimal("2.55")
        assert calculate_discounted_star_cost(Decimal("0.01"), 80) == Decimal("0.01")

    def test_redeem_with_discount_saves_snapshot(self, client, db_session):
        token = _register_parent(client)
        child_id = _create_child(client, token)
        device_token = _bind_child(client, token, child_id)
        plan_id = _create_plan(client, token, child_id)
        tasks = client.post(
            f"/api/v1/plans/{plan_id}/daily-tasks",
            headers={"Authorization": f"Bearer {token}"},
            json={"task_date": str(date.today()), "tasks": [{"title": "earn", "expected_minutes": 5, "reward_stars": 5}]},
        )
        assert tasks.status_code == 201
        task_id = tasks.json()[0]["id"]
        complete = client.patch(f"/api/v1/child/tasks/{task_id}/complete", headers={"Authorization": f"Bearer {device_token}"}, json={"feedback": "done"})
        assert complete.status_code == 200
        settings = client.patch(
            f"/api/v1/children/{child_id}/reward-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "streak_threshold": 1,
                "streak_discount_enabled": True,
                "streak_discount_tiers": [
                    {"days": 7, "discount_percent": 90},
                    {"days": 14, "discount_percent": 85},
                    {"days": 21, "discount_percent": 80},
                ],
            },
        )
        assert settings.status_code == 200
        db_session.execute(text("UPDATE streaks SET current_days = 7 WHERE child_id = :child_id"), {"child_id": child_id})
        db_session.commit()
        item = client.post("/api/v1/shop/items", headers={"Authorization": f"Bearer {token}"}, json={"title": "toy", "star_cost": 3.00})
        assert item.status_code == 200

        redeem = client.post(f"/api/v1/child/shop/items/{item.json()['id']}/redeem", headers={"Authorization": f"Bearer {device_token}"})

        assert redeem.status_code == 200
        redemption = db_session.query(Redemption).order_by(Redemption.created_at.desc()).first()
        assert redemption.original_star_cost == Decimal("3.00")
        assert redemption.final_star_cost == Decimal("2.70")
        assert redemption.discount_percent == 90
        ledger = db_session.query(RewardLedger).filter(RewardLedger.source_id == redemption.id).one()
        assert ledger.stars_delta == Decimal("-2.70")
