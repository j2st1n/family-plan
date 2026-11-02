import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from httpx import Response, TimeoutException

from app.core.config import settings
from app.core.ratelimit import auth_limiter
from app.schemas.ai import CopilotParseResult
from app.services.ai import (
    CircuitBreaker,
    CircuitBreakerState,
    heuristic_parse_tasks,
    ai_service,
)


@pytest.fixture
def parent_token(client):
    auth_limiter._global._buckets.clear()
    username = f"parent_{uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "password12345"},
    )
    assert resp.status_code == 201
    return resp.json()["token"]


class TestHeuristicParser:
    def test_single_task_piano_practice_with_time_and_approval(self):
        prompt = "每天晚上7点练琴20分钟给1星需确认"
        res: CopilotParseResult = heuristic_parse_tasks(prompt)
        assert res.is_degraded is True
        assert len(res.tasks) == 1
        t = res.tasks[0]
        assert "练琴" in t.title
        assert t.expected_minutes == 20
        assert t.reward_stars == 1
        assert t.require_approval is True
        assert t.start == "19:00"
        assert t.end == "19:20"
        assert t.scheduled_start == "19:00"
        assert t.scheduled_end == "19:20"
        assert t.category == "学习思考"

    def test_multi_task_spoken_prompt(self):
        prompt = "明天上午读绘本20分钟，下午跳绳500下(2星)，晚上口算拍照审核"
        res: CopilotParseResult = heuristic_parse_tasks(prompt)
        assert res.is_degraded is True
        assert len(res.tasks) == 3

        # Task 1: 读绘本
        t1 = res.tasks[0]
        assert "读绘本" in t1.title
        assert t1.expected_minutes == 20
        assert t1.category == "学习思考"
        assert t1.require_approval is False

        # Task 2: 跳绳500下
        t2 = res.tasks[1]
        assert "跳绳" in t2.title
        assert t2.reward_stars == 2
        assert t2.category == "体育运动"

        # Task 3: 口算拍照审核
        t3 = res.tasks[2]
        assert "口算" in t3.title
        assert t3.require_approval is True
        assert t3.category == "学习思考"

    def test_chore_and_habit_categories(self):
        chore_res = heuristic_parse_tasks("整理房间收拾书包15分钟")
        assert len(chore_res.tasks) >= 1
        assert chore_res.tasks[0].category == "家务协助"
        assert chore_res.tasks[0].expected_minutes == 15

        habit_res = heuristic_parse_tasks("睡前刷牙洗脸10分钟 1星")
        assert len(habit_res.tasks) >= 1
        assert habit_res.tasks[0].category == "生活自理"
        assert habit_res.tasks[0].expected_minutes == 10


class TestCircuitBreaker:
    def test_state_transitions(self):
        cb = CircuitBreaker(failure_threshold=3, reset_timeout=0.1)
        assert cb.state == CircuitBreakerState.CLOSED
        assert cb.can_attempt() is True

        # 1st failure
        cb.record_failure()
        assert cb.state == CircuitBreakerState.CLOSED

        # 2nd failure
        cb.record_failure()
        assert cb.state == CircuitBreakerState.CLOSED

        # 3rd failure -> trips to OPEN
        cb.record_failure()
        assert cb.state == CircuitBreakerState.OPEN
        assert cb.can_attempt() is False

        # Sleep past reset timeout -> transitions to HALF_OPEN
        import time
        time.sleep(0.12)
        assert cb.state == CircuitBreakerState.HALF_OPEN
        assert cb.can_attempt() is True
        # In half-open, only 1 attempt allowed until settled
        assert cb.can_attempt() is False

        # If success -> CLOSED
        cb.record_success()
        assert cb.state == CircuitBreakerState.CLOSED

        # If failure in HALF_OPEN -> immediately trips back to OPEN
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitBreakerState.OPEN
        time.sleep(0.12)
        assert cb.state == CircuitBreakerState.HALF_OPEN
        cb.record_failure()
        assert cb.state == CircuitBreakerState.OPEN


class TestAIServiceResilience:
    @pytest.mark.anyio
    async def test_successful_model_call(self):
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"raw_summary": "解析成功",'
                            ' "tasks": [{'
                            '   "title": "晚间奥数辅导",'
                            '   "expected_minutes": 30,'
                            '   "reward_stars": 2,'
                            '   "category": "学习思考",'
                            '   "start": "20:00",'
                            '   "end": "20:30",'
                            '   "require_approval": true'
                            " }]}"
                        )
                    }
                }
            ]
        }

        with (
            patch.object(settings, "ai_api_key", "sk-mock-key"),
            patch.object(settings, "ai_base_url", "https://api.mock.ai/v1"),
            patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post,
        ):
            mock_post.return_value = Response(200, json=mock_response)
            ai_service.circuit_breaker.reset()

            result = await ai_service.parse_tasks_copilot("晚上8点奥数30分钟2星需审核")
            assert result.is_degraded is False
            assert len(result.tasks) == 1
            assert result.tasks[0].title == "晚间奥数辅导"
            assert result.tasks[0].expected_minutes == 30
            assert result.tasks[0].reward_stars == 2
            assert result.tasks[0].category == "学习思考"
            assert result.tasks[0].start == "20:00"
            assert result.tasks[0].end == "20:30"
            assert result.tasks[0].require_approval is True
            assert ai_service.circuit_breaker.state == CircuitBreakerState.CLOSED

    @pytest.mark.anyio
    async def test_timeout_fallback_to_heuristic(self):
        with (
            patch.object(settings, "ai_api_key", "sk-mock-key"),
            patch.object(settings, "ai_base_url", "https://api.mock.ai/v1"),
            patch.object(settings, "ai_timeout_seconds", 0.05),
            patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post,
        ):
            async def slow_call(*args, **kwargs):
                await asyncio.sleep(0.2)
                return Response(200, json={})

            mock_post.side_effect = slow_call
            ai_service.circuit_breaker.reset()

            result = await ai_service.parse_tasks_copilot("每天晚上7点练琴20分钟给1星需确认")
            assert result.is_degraded is True
            assert len(result.tasks) == 1
            assert "练琴" in result.tasks[0].title
            assert result.tasks[0].require_approval is True


class TestAIRoutes:
    def test_health_endpoint(self, client):
        resp = client.get("/api/v1/ai/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "circuit_breaker_state" in data
        assert "timeout_seconds" in data

    def test_copilot_parse_endpoint_unauthorized(self, client):
        resp = client.post(
            "/api/v1/ai/copilot/parse-tasks",
            json={"prompt": "晚上7点练琴20分钟"},
        )
        assert resp.status_code == 401

    def test_copilot_parse_endpoint_authorized(self, client, parent_token):
        headers = {"Authorization": f"Bearer {parent_token}"}
        resp = client.post(
            "/api/v1/ai/copilot/parse-tasks",
            headers=headers,
            json={
                "prompt": "每天晚上7点练琴20分钟给1星需确认",
                "target_date": date.today().isoformat(),
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert len(data["tasks"]) == 1
        t = data["tasks"][0]
        assert t["title"]
        assert t["expected_minutes"] == 20
        assert t["reward_stars"] == 1
        assert t["category"] == "学习思考"
        assert t["start"] == "19:00"
        assert t["end"] == "19:20"
        assert t["require_approval"] is True
