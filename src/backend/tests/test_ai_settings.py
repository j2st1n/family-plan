import asyncio
import time
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from httpx import Response, TimeoutException
from sqlalchemy.orm import Session

from app.core.ai_crypto import (
    decrypt_ai_api_key,
    encrypt_ai_api_key,
    is_masked_api_key,
    mask_api_key,
)
from app.core.config import settings
from app.core.deps import get_db
from app.core.ratelimit import auth_limiter
from app.models.parent import Parent
from app.models.parent_ai_settings import ParentAISettings


@pytest.fixture
def auth_client(client):
    auth_limiter._global._buckets.clear()
    uname = f"parent_{uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": uname, "password": "password12345"},
    )
    assert resp.status_code == 201
    tok = resp.json()["token"]
    return client, tok, uname


class TestAICrypto:
    def test_aes_gcm_roundtrip(self):
        secret = "sk-deepseek-live-secret-key-1234567890abcdef"
        encrypted = encrypt_ai_api_key(secret)
        assert encrypted is not None
        assert encrypted.startswith("gcm:")
        assert secret not in encrypted  # No plaintext in ciphertext!

        # Repeat encryption produces different nonce/ciphertext
        second = encrypt_ai_api_key(secret)
        assert second != encrypted

        decrypted = decrypt_ai_api_key(encrypted)
        assert decrypted == secret

    def test_tampered_or_invalid_ciphertext(self):
        assert decrypt_ai_api_key(None) is None
        assert decrypt_ai_api_key("") is None
        assert decrypt_ai_api_key("gcm:not-valid-base64!!!") is None
        assert decrypt_ai_api_key("gcm:AAAA") is None

    def test_mask_api_key_formats(self):
        # sk- prefix
        assert mask_api_key("sk-1234567890abcdef3a8f") == "sk-****3a8f"
        assert mask_api_key("sk-test-super-secret-key-3a8f") == "sk-****3a8f"
        # Non sk- prefix
        assert mask_api_key("ollama-token-secret-9988") == "oll****9988"
        # Short strings
        assert mask_api_key("1234") == "****"
        assert mask_api_key("123456") == "****3456"
        # Empty
        assert mask_api_key("") == ""
        assert mask_api_key(None) == ""

    def test_is_masked_detection(self):
        assert is_masked_api_key("sk-****3a8f") is True
        assert is_masked_api_key("****3a8f") is True
        assert is_masked_api_key("oll****9988") is True
        assert is_masked_api_key("sk-real-plain-api-key-123456") is False
        assert is_masked_api_key("") is False


class TestAISettingsAPI:
    def test_get_settings_default_unconfigured(self, auth_client):
        client, tok, _ = auth_client
        resp = client.get("/api/v1/ai/settings", headers={"Authorization": f"Bearer {tok}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "deepseek"
        assert data["has_api_key"] is False
        assert data["api_key_masked"] == ""
        assert data["active_mode"] == "纯离线规则"
        assert data["is_enabled"] is True

    def test_put_settings_encrypts_key_and_masks_in_response(self, auth_client):
        client, tok, uname = auth_client
        plain_key = "sk-live-secret-deepseek-token-3a8f"

        put_resp = client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "provider": "deepseek",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": plain_key,
                "model": "deepseek-chat",
                "is_enabled": True,
            },
        )
        assert put_resp.status_code == 200
        data = put_resp.json()
        assert data["has_api_key"] is True
        assert data["api_key_masked"] == "sk-****3a8f"
        assert plain_key not in put_resp.text  # Plaintext key is NEVER leaked in response!
        assert data["active_mode"] == "DeepSeek"

        # Verify database record: Plaintext is NEVER stored in database
        from app.db.session import SessionLocal

        with SessionLocal() as db:
            parent = db.query(Parent).filter(Parent.username == uname).first()
            assert parent is not None
            row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == parent.id).first()
            assert row is not None
            assert row.api_key_encrypted.startswith("gcm:")
            assert plain_key not in row.api_key_encrypted
            # Decrypt verifies roundtrip
            assert decrypt_ai_api_key(row.api_key_encrypted) == plain_key

    def test_put_settings_preserves_existing_key_when_empty_or_masked(self, auth_client):
        client, tok, uname = auth_client
        plain_key = "sk-first-secret-token-3a8f"

        # 1. First save
        client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={"provider": "deepseek", "api_key": plain_key, "model": "deepseek-chat"},
        )

        # 2. Update model and send masked key back
        upd_resp = client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={"provider": "deepseek", "api_key": "sk-****3a8f", "model": "deepseek-reasoner"},
        )
        assert upd_resp.status_code == 200
        assert upd_resp.json()["model"] == "deepseek-reasoner"
        assert upd_resp.json()["has_api_key"] is True
        assert upd_resp.json()["api_key_masked"] == "sk-****3a8f"

        # Verify key was preserved, not overwritten with masked string
        from app.db.session import SessionLocal

        with SessionLocal() as db:
            parent = db.query(Parent).filter(Parent.username == uname).first()
            row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == parent.id).first()
            assert decrypt_ai_api_key(row.api_key_encrypted) == plain_key

    def test_put_settings_clear_key(self, auth_client):
        client, tok, _ = auth_client
        client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={"provider": "deepseek", "api_key": "sk-test-key-3a8f"},
        )
        clear_resp = client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={"clear_api_key": True},
        )
        assert clear_resp.status_code == 200
        assert clear_resp.json()["has_api_key"] is False
        assert clear_resp.json()["api_key_masked"] == ""
        assert clear_resp.json()["active_mode"] == "纯离线规则"


class TestAITestConnectionAPI:
    def test_probe_missing_key(self, auth_client):
        client, tok, _ = auth_client
        resp = client.post(
            "/api/v1/ai/test-connection",
            headers={"Authorization": f"Bearer {tok}"},
            json={"provider": "deepseek", "base_url": "https://api.deepseek.com/v1", "api_key": ""},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["status_code"] == 400
        assert "API Key" in data["message"]

    def test_probe_success(self, auth_client):
        client, tok, _ = auth_client
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = Response(200, json={"choices": [{"message": {"content": "pong"}}]})

            resp = client.post(
                "/api/v1/ai/test-connection",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "provider": "deepseek",
                    "base_url": "https://api.deepseek.com/v1",
                    "api_key": "sk-probe-test-key",
                    "model": "deepseek-chat",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["latency_ms"] is not None
            assert "连接成功" in data["message"]

    def test_probe_auth_failure(self, auth_client):
        client, tok, _ = auth_client
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = Response(401, text="Unauthorized: invalid api key")

            resp = client.post(
                "/api/v1/ai/test-connection",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "provider": "openai",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "sk-invalid-key",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert data["status_code"] == 401
            assert "鉴权失败" in data["message"]

    def test_probe_timeout(self, auth_client):
        client, tok, _ = auth_client
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = TimeoutException("Connection timed out")

            resp = client.post(
                "/api/v1/ai/test-connection",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "provider": "custom",
                    "base_url": "http://10.255.255.1:8000/v1",
                    "api_key": "sk-custom-key",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is False
            assert data["status_code"] == 408
            assert "超时" in data["message"]


class TestParentAICopilotIntegration:
    def test_parse_copilot_uses_parent_configured_key(self, auth_client):
        client, tok, _ = auth_client
        # 1. Configure parent's custom model and key
        client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "provider": "deepseek",
                "base_url": "https://api.parent-private.ai/v1",
                "api_key": "sk-parent-private-key-7788",
                "model": "parent-custom-model",
                "is_enabled": True,
            },
        )

        # 2. Call parse-tasks with mock httpx
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": '{"raw_summary": "解析成功", "tasks": [{"title": "口算打卡", "expected_minutes": 15, "reward_stars": 1, "category": "学习思考", "require_approval": false}]}'
                            }
                        }
                    ]
                },
            )

            resp = client.post(
                "/api/v1/ai/copilot/parse-tasks",
                headers={"Authorization": f"Bearer {tok}"},
                json={"prompt": "做口算15分钟"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_degraded"] is False
            assert len(data["tasks"]) == 1
            assert data["tasks"][0]["title"] == "口算打卡"

            # Verify that mock_post received the parent's private key and endpoint
            mock_post.assert_called_once()
            call_url = str(mock_post.call_args[0][0])
            call_headers = mock_post.call_args[1]["headers"]
            call_json = mock_post.call_args[1]["json"]
            assert "api.parent-private.ai" in call_url
            assert call_headers["Authorization"] == "Bearer sk-parent-private-key-7788"
            assert call_json["model"] == "parent-custom-model"

    def test_parse_copilot_disabled_by_parent_falls_back(self, auth_client):
        client, tok, _ = auth_client
        client.put(
            "/api/v1/ai/settings",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "provider": "deepseek",
                "api_key": "sk-some-key",
                "is_enabled": False,  # Parent turned off AI
            },
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            resp = client.post(
                "/api/v1/ai/copilot/parse-tasks",
                headers={"Authorization": f"Bearer {tok}"},
                json={"prompt": "每天晚上7点练琴20分钟给1星需确认"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_degraded"] is True
            assert len(data["tasks"]) == 1
            assert "练琴" in data["tasks"][0]["title"]
            # Ensure model was NEVER called
            mock_post.assert_not_called()
