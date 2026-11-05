import asyncio
import time
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.ai_crypto import (
    decrypt_ai_api_key,
    encrypt_ai_api_key,
    is_masked_api_key,
    mask_api_key,
)
from app.core.config import settings
from app.core.deps import get_current_parent
from app.db.session import get_db
from app.models.parent import Parent
from app.models.parent_ai_settings import ParentAISettings
from app.schemas.ai import (
    AIFetchModelsRequest,
    AIFetchModelsResponse,
    AIHealthStatus,
    AISettingsResponse,
    AISettingsUpdateRequest,
    AITestConnectionRequest,
    AITestConnectionResponse,
    CopilotParseRequest,
    CopilotParseResult,
)
from app.services.ai import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


def _compute_active_mode(
    is_enabled: bool,
    provider: str,
    has_api_key: bool,
) -> str:
    if not is_enabled:
        return "纯离线规则"
    p = (provider or "").lower()
    if p == "ollama":
        return "本地 Ollama"
    if p == "deepseek":
        return "DeepSeek" if (has_api_key or bool(settings.ai_api_key)) else "纯离线规则"
    if p == "openai":
        return "OpenAI" if (has_api_key or bool(settings.ai_api_key)) else "纯离线规则"
    if p == "custom":
        return "自定义中转" if (has_api_key or bool(settings.ai_api_key)) else "纯离线规则"
    return provider.capitalize() if has_api_key else "纯离线规则"


@router.get("/settings", response_model=AISettingsResponse)
def get_parent_ai_settings(
    current_parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> AISettingsResponse:
    """
    获取当前家长的 AI 模型个性化设置。
    返回的 API Key 必须经过严格脱敏打码（如 sk-****3a8f），绝不回传明文。
    """
    row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == current_parent.id).first()
    if not row:
        default_provider = "deepseek"
        has_key = bool(settings.ai_api_key)
        mode = _compute_active_mode(True, default_provider, has_key)
        return AISettingsResponse(
            provider=default_provider,
            base_url="https://api.deepseek.com/v1",
            model="deepseek-chat",
            has_api_key=has_key,
            api_key_masked=mask_api_key(settings.ai_api_key) if has_key else "",
            is_enabled=True,
            active_mode=mode,
        )

    decrypted = decrypt_ai_api_key(row.api_key_encrypted)
    has_key = bool(decrypted and decrypted.strip())
    masked = mask_api_key(decrypted) if has_key else ""
    mode = _compute_active_mode(row.is_enabled, row.provider, has_key)

    return AISettingsResponse(
        provider=row.provider,
        base_url=row.base_url or "",
        model=row.model,
        has_api_key=has_key,
        api_key_masked=masked,
        is_enabled=row.is_enabled,
        active_mode=mode,
    )


@router.put("/settings", response_model=AISettingsResponse)
def update_parent_ai_settings(
    payload: AISettingsUpdateRequest,
    current_parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> AISettingsResponse:
    """
    更新或创建当前家长的 AI 模型设置。
    支持修改 Base URL / Provider / Model，支持更新新 Key 或留空/脱敏保持原 Key。
    API Key 必须通过 AES-256-GCM 服务端密钥派生加密持久化。
    """
    row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == current_parent.id).first()
    if not row:
        row = ParentAISettings(
            parent_id=current_parent.id,
            provider=(payload.provider or "deepseek").strip().lower(),
            base_url=(payload.base_url or "").strip(),
            model=(payload.model or "deepseek-chat").strip(),
            is_enabled=payload.is_enabled if payload.is_enabled is not None else True,
        )
        db.add(row)

    if payload.provider is not None:
        row.provider = payload.provider.strip().lower()
    if payload.base_url is not None:
        row.base_url = payload.base_url.strip()
    if payload.model is not None:
        row.model = payload.model.strip()
    if payload.is_enabled is not None:
        row.is_enabled = payload.is_enabled

    # 处理 API Key：显式清空、输入新 Key、或保持不变
    if payload.clear_api_key:
        row.api_key_encrypted = None
    elif payload.api_key is not None:
        k = payload.api_key.strip()
        if k == "__CLEAR__":
            row.api_key_encrypted = None
        elif k and not is_masked_api_key(k):
            # 新输入的有效明文密钥 -> AES-256-GCM 加密存储
            row.api_key_encrypted = encrypt_ai_api_key(k)
        # 否则若为 "" 或 maskedKey，保持原有 row.api_key_encrypted 不变

    db.commit()
    db.refresh(row)

    decrypted = decrypt_ai_api_key(row.api_key_encrypted)
    has_key = bool(decrypted and decrypted.strip())
    masked = mask_api_key(decrypted) if has_key else ""
    mode = _compute_active_mode(row.is_enabled, row.provider, has_key)

    return AISettingsResponse(
        provider=row.provider,
        base_url=row.base_url or "",
        model=row.model,
        has_api_key=has_key,
        api_key_masked=masked,
        is_enabled=row.is_enabled,
        active_mode=mode,
    )


@router.post("/test-connection", response_model=AITestConnectionResponse)
async def test_ai_connection(
    payload: AITestConnectionRequest,
    current_parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> AITestConnectionResponse:
    """
    发起真实轻量连通性探测并返回毫秒耗时与状态。
    探测当前输入或已保存模型的响应可用性与鉴权有效性。
    """
    saved_row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == current_parent.id).first()

    provider = (
        payload.provider
        or (saved_row.provider if saved_row else None)
        or "deepseek"
    ).strip().lower()

    base_url = (
        payload.base_url
        if payload.base_url is not None
        else (saved_row.base_url if saved_row else "")
    )
    base_url = (base_url or "").strip().rstrip("/")
    if not base_url:
        if provider == "deepseek":
            base_url = "https://api.deepseek.com/v1"
        elif provider == "openai":
            base_url = "https://api.openai.com/v1"
        elif provider == "ollama":
            base_url = "http://localhost:11434/v1"
        else:
            base_url = "https://api.deepseek.com/v1"

    model = (
        payload.model
        or (saved_row.model if saved_row else None)
        or ("deepseek-chat" if provider == "deepseek" else "gpt-4o-mini")
    ).strip()

    # 提取探测所需 API Key
    target_key: Optional[str] = None
    if payload.api_key is not None and payload.api_key.strip() and not is_masked_api_key(payload.api_key):
        target_key = payload.api_key.strip()
    elif saved_row and saved_row.api_key_encrypted:
        target_key = decrypt_ai_api_key(saved_row.api_key_encrypted)
    elif settings.ai_api_key:
        target_key = settings.ai_api_key.strip()

    if provider != "ollama" and not target_key:
        return AITestConnectionResponse(
            success=False,
            latency_ms=None,
            message="未检测到有效 API Key，请先输入密钥后探测",
            status_code=400,
        )

    # 规范化 endpoint
    clean_base = base_url.rstrip("/")
    if clean_base.endswith("/chat/completions"):
        endpoint = clean_base
    elif clean_base.endswith("/v1"):
        endpoint = f"{clean_base}/chat/completions"
    else:
        endpoint = f"{clean_base}/v1/chat/completions"

    headers = {"Content-Type": "application/json"}
    if target_key:
        headers["Authorization"] = f"Bearer {target_key}"

    probe_payload = {
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(endpoint, json=probe_payload, headers=headers)
            latency_ms = max(1, int((time.perf_counter() - t0) * 1000))
            if resp.status_code == 200:
                return AITestConnectionResponse(
                    success=True,
                    latency_ms=latency_ms,
                    message=f"连接成功 ({latency_ms}ms)",
                    status_code=200,
                )
            elif resp.status_code in (401, 403):
                return AITestConnectionResponse(
                    success=False,
                    latency_ms=latency_ms,
                    message=f"鉴权失败：API Key 无效或未授权 (HTTP {resp.status_code})",
                    status_code=resp.status_code,
                )
            elif resp.status_code == 404:
                return AITestConnectionResponse(
                    success=False,
                    latency_ms=latency_ms,
                    message="端点不存在：请检查 Base URL (HTTP 404)",
                    status_code=404,
                )
            else:
                text_snippet = resp.text[:120].strip()
                return AITestConnectionResponse(
                    success=False,
                    latency_ms=latency_ms,
                    message=f"服务响应异常 (HTTP {resp.status_code}): {text_snippet}",
                    status_code=resp.status_code,
                )
    except (httpx.TimeoutException, TimeoutError, asyncio.TimeoutError):
        return AITestConnectionResponse(
            success=False,
            latency_ms=None,
            message="连接超时：请求超过 4 秒无响应，请检查 Base URL 网络连通性",
            status_code=408,
        )
    except Exception as exc:
        return AITestConnectionResponse(
            success=False,
            latency_ms=None,
            message=f"网络请求失败：{str(exc)[:120]}",
            status_code=500,
        )


@router.post("/fetch-models", response_model=AIFetchModelsResponse)
async def fetch_ai_models(
    payload: AIFetchModelsRequest,
    current_parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> AIFetchModelsResponse:
    """
    拉取远程 Base URL 提供的可用模型列表（兼容 OpenAI /v1/models 与 Ollama /api/tags）。
    """
    saved_row = db.query(ParentAISettings).filter(ParentAISettings.parent_id == current_parent.id).first()

    provider = (
        payload.provider
        or (saved_row.provider if saved_row else None)
        or "deepseek"
    ).strip().lower()

    base_url = (
        payload.base_url
        if payload.base_url is not None
        else (saved_row.base_url if saved_row else "")
    )
    base_url = (base_url or "").strip().rstrip("/")
    if not base_url:
        if provider == "deepseek":
            base_url = "https://api.deepseek.com/v1"
        elif provider == "openai":
            base_url = "https://api.openai.com/v1"
        elif provider == "ollama":
            base_url = "http://localhost:11434/v1"
        else:
            base_url = "https://api.deepseek.com/v1"

    target_key: Optional[str] = None
    if payload.api_key is not None and payload.api_key.strip() and not is_masked_api_key(payload.api_key):
        target_key = payload.api_key.strip()
    elif saved_row and saved_row.api_key_encrypted:
        target_key = decrypt_ai_api_key(saved_row.api_key_encrypted)
    elif settings.ai_api_key:
        target_key = settings.ai_api_key.strip()

    # Determine endpoint
    clean_base = base_url.rstrip("/")
    if clean_base.endswith("/chat/completions"):
        clean_base = clean_base[:-17]

    if clean_base.endswith("/v1"):
        endpoint = f"{clean_base}/models"
    else:
        endpoint = f"{clean_base}/v1/models"

    headers = {"Content-Type": "application/json"}
    if target_key:
        headers["Authorization"] = f"Bearer {target_key}"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(endpoint, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                raw_models = []
                if isinstance(data, dict):
                    if "data" in data and isinstance(data["data"], list):
                        raw_models = data["data"]
                    elif "models" in data and isinstance(data["models"], list):
                        raw_models = data["models"]
                elif isinstance(data, list):
                    raw_models = data

                model_ids = []
                for m in raw_models:
                    if isinstance(m, dict) and "id" in m:
                        model_ids.append(str(m["id"]))
                    elif isinstance(m, dict) and "name" in m:
                        model_ids.append(str(m["name"]))
                    elif isinstance(m, str):
                        model_ids.append(m)

                if model_ids:
                    return AIFetchModelsResponse(
                        success=True,
                        models=model_ids[:50],
                        message=f"成功获取 {len(model_ids)} 个可用模型",
                    )
                else:
                    return AIFetchModelsResponse(
                        success=False,
                        models=[],
                        message="服务端未返回任何模型项",
                    )
            elif resp.status_code == 401:
                return AIFetchModelsResponse(
                    success=False,
                    models=[],
                    message="鉴权失败：API Key 无效或未授权 (HTTP 401)",
                )
            else:
                return AIFetchModelsResponse(
                    success=False,
                    models=[],
                    message=f"拉取失败 (HTTP {resp.status_code})：端点可能不支持 /models",
                )
    except (httpx.TimeoutException, TimeoutError, asyncio.TimeoutError):
        return AIFetchModelsResponse(
            success=False,
            models=[],
            message="拉取超时：请求超过 4 秒无响应",
        )
    except Exception as exc:
        return AIFetchModelsResponse(
            success=False,
            models=[],
            message=f"拉取模型失败：{str(exc)[:100]}",
        )


@router.post("/copilot/parse-tasks", response_model=CopilotParseResult)
async def parse_copilot_tasks(
    payload: CopilotParseRequest,
    current_parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> CopilotParseResult:
    """
    自然语言解析生成结构化任务清单草稿。
    优先读取当前家长已配置的私有模型与 Key，如未配置或熔断则降级为本地离线规则。
    """
    return await ai_service.parse_tasks_copilot(
        prompt=payload.prompt,
        child_id=payload.child_id,
        target_date=payload.target_date,
        parent=current_parent,
        db=db,
    )


@router.get("/health", response_model=AIHealthStatus)
def get_ai_health() -> AIHealthStatus:
    """获取当前 AI 基础底座与熔断器健康状态"""
    return ai_service.get_health()
