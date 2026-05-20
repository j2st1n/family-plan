import importlib
from fastapi.testclient import TestClient
import pytest
from app.main import create_app

@pytest.fixture
def client():
    return TestClient(create_app())

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
    def test_login_rate_limit(self, client, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "a"*32)
        pw, un = "pass12345", "lim_test"
        r = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
        assert r.status_code == 201
        for _ in range(8):
            client.post("/api/v1/auth/login", json={"username": un, "password": "wrong1a"})
        r = client.post("/api/v1/auth/login", json={"username": un, "password": "wrong1a"})
        assert r.status_code == 429

class TestCompleteTask:
    def test_unapproved_task_rejected(self, client, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "a"*32)
        pw, un = "pass12345", "appr_test"
        auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
        token = auth.json()["token"]
        child = client.post("/api/v1/children", headers={"Authorization": f"Bearer {token}"}, json={"name": "c1"})
        cid = child.json()["id"]
        code = client.post(f"/api/v1/children/{cid}/access-code", headers={"Authorization": f"Bearer {token}"}).json()["code"]
        dev = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "d1"})
        dtoken = dev.json()["device_token"]
        client.post("/api/v1/plans", headers={"Authorization": f"Bearer {token}"}, json={"child_id": cid, "title": "p1", "start_date": "2026-05-19"})
        task = client.post("/api/v1/child/tasks", headers={"Authorization": f"Bearer {dtoken}"}, json={"title": "s", "expected_minutes": 5, "reward_stars": 2})
        tid = task.json()["id"]
        r = client.patch(f"/api/v1/child/tasks/{tid}/complete", headers={"Authorization": f"Bearer {dtoken}"}, json={"feedback": "easy"})
        assert r.status_code == 409
