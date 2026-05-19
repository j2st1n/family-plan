import importlib

from fastapi.testclient import TestClient
import pytest

from app.main import app

client = TestClient(app)


class TestJWTSecretValidation:
    def test_empty_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "")
        with pytest.raises(RuntimeError, match="JWT_SECRET is required"):
            importlib.reload(__import__("app.main", fromlist=["_"]))

    def test_short_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "123")
        with pytest.raises(RuntimeError, match="at least 32"):
            importlib.reload(__import__("app.main", fromlist=["_"]))

    def test_forbidden_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "family-plan-dev")
        with pytest.raises(RuntimeError, match="default value"):
            importlib.reload(__import__("app.main", fromlist=["_"]))


class TestAuthRateLimit:
    def test_login_rate_limit(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "a" * 32)
        pw = "pass12345"
        username = "limiter_tester"
        resp = client.post("/api/v1/auth/register", json={"username": username, "password": pw})
        assert resp.status_code == 201
        for _ in range(8):
            client.post("/api/v1/auth/login", json={"username": username, "password": "wrong1a"})
        resp = client.post("/api/v1/auth/login", json={"username": username, "password": "wrong1a"})
        assert resp.status_code == 429


class TestCompleteTask:
    def test_unapproved_task_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "a" * 32)
        pw = "pass12345"
        username = "approver_tester"

        auth_resp = client.post("/api/v1/auth/register", json={"username": username, "password": pw})
        token = auth_resp.json()["token"]

        child_resp = client.post("/api/v1/children", headers={"Authorization": f"Bearer {token}"}, json={"name": "t"})
        child_id = child_resp.json()["id"]

        code_resp = client.post(f"/api/v1/children/{child_id}/access-code", headers={"Authorization": f"Bearer {token}"})
        code = code_resp.json()["code"]

        bind_resp = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "t"})
        dev_token = bind_resp.json()["device_token"]

        client.post("/api/v1/plans", headers={"Authorization": f"Bearer {token}"}, json={
            "child_id": child_id, "title": "plan", "start_date": "2026-05-19"
        })

        task_resp = client.post("/api/v1/child/tasks", headers={"Authorization": f"Bearer {dev_token}"}, json={
            "title": "self task", "expected_minutes": 10, "reward_stars": 3
        })
        task_id = task_resp.json()["id"]

        resp = client.patch(f"/api/v1/child/tasks/{task_id}/complete", headers={"Authorization": f"Bearer {dev_token}"}, json={"feedback": "easy"})
        assert resp.status_code == 409
