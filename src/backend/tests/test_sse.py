import asyncio
from datetime import date
from uuid import UUID, uuid4

import pytest

from app.core.security import decode_parent_token
from app.services.event_hub import event_hub


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _register_parent(client):
    username = "sse" + uuid4().hex[:8]
    response = client.post("/api/v1/auth/register", json={"username": username, "password": "pass12345"})
    assert response.status_code == 201
    return response.json()["token"]


def _create_child(client, token):
    response = client.post(
        "/api/v1/children",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "sse-child"},
    )
    assert response.status_code == 200
    return response.json()["id"]


def _bind_child(client, token, child_id):
    code_response = client.post(
        f"/api/v1/children/{child_id}/access-code",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert code_response.status_code == 200
    bind_response = client.post(
        "/api/v1/child-devices/bind",
        json={"code": code_response.json()["code"], "display_name": "ipad"},
    )
    assert bind_response.status_code == 200
    return bind_response.json()["device_token"]


def _create_plan(client, token, child_id):
    response = client.post(
        "/api/v1/plans",
        headers={"Authorization": f"Bearer {token}"},
        json={"child_id": child_id, "title": "sse-plan", "start_date": str(date.today())},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _parent_id(token: str) -> UUID:
    parent_id = decode_parent_token(token)
    assert parent_id is not None
    return UUID(parent_id)


class TestSseEvents:
    def setup_method(self):
        event_hub.reset()

    def test_parent_event_stream_requires_valid_token(self, client):
        response = client.get("/api/v1/events/parent", headers={"Authorization": "Bearer bad"})
        assert response.status_code == 401

    def test_child_event_stream_requires_valid_token(self, client):
        response = client.get("/api/v1/child/events", headers={"Authorization": "Bearer bad"})
        assert response.status_code == 401

    @pytest.mark.anyio
    async def test_parent_write_publishes_task_event(self, client):
        token = _register_parent(client)
        parent_id = _parent_id(token)
        child_id = _create_child(client, token)
        plan_id = _create_plan(client, token, child_id)
        subscription = event_hub.subscribe(parent_id)
        pending_event = asyncio.create_task(subscription.__anext__())
        await asyncio.sleep(0)

        response = client.post(
            f"/api/v1/plans/{plan_id}/daily-tasks",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "task_date": str(date.today()),
                "tasks": [{"title": "read", "expected_minutes": 10, "reward_stars": 1}],
            },
        )

        assert response.status_code == 201
        event = await asyncio.wait_for(pending_event, timeout=1)
        assert event.topic == "tasks"
        assert event.reason == "task_created"
        assert event.parent_id == parent_id
        assert str(event.child_id) == child_id
        await subscription.aclose()

    @pytest.mark.anyio
    async def test_child_write_publishes_event_for_parent_scope(self, client):
        token = _register_parent(client)
        parent_id = _parent_id(token)
        child_id = _create_child(client, token)
        device_token = _bind_child(client, token, child_id)
        plan_id = _create_plan(client, token, child_id)
        tasks_response = client.post(
            f"/api/v1/plans/{plan_id}/daily-tasks",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "task_date": str(date.today()),
                "tasks": [{"title": "write", "expected_minutes": 10, "reward_stars": 1}],
            },
        )
        task_id = tasks_response.json()[0]["id"]
        subscription = event_hub.subscribe(parent_id)
        pending_event = asyncio.create_task(subscription.__anext__())
        await asyncio.sleep(0)

        response = client.patch(
            f"/api/v1/child/tasks/{task_id}/complete",
            headers={"Authorization": f"Bearer {device_token}"},
            json={"feedback": "easy"},
        )

        assert response.status_code == 200
        event = await asyncio.wait_for(pending_event, timeout=1)
        assert event.topic == "tasks"
        assert event.reason == "task_completed"
        assert event.parent_id == parent_id
        assert str(event.child_id) == child_id
        await subscription.aclose()
