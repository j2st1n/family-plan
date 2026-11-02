from fastapi import APIRouter, Depends
from app.core.deps import get_current_parent
from app.models.parent import Parent
from app.schemas.ai import AIHealthStatus, CopilotParseRequest, CopilotParseResult
from app.services.ai import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/copilot/parse-tasks", response_model=CopilotParseResult)
async def parse_copilot_tasks(
    payload: CopilotParseRequest,
    current_parent: Parent = Depends(get_current_parent),
) -> CopilotParseResult:
    """
    自然语言解析生成结构化任务清单草稿。
    支持家长日常口语文本（如：“每天晚上7点练琴20分钟给1星需确认”），
    AI 服务不可用或响应超时 (2.5s) 时自动回退确定性启发式规则解析。
    """
    return await ai_service.parse_tasks_copilot(
        prompt=payload.prompt,
        child_id=payload.child_id,
        target_date=payload.target_date,
    )


@router.get("/health", response_model=AIHealthStatus)
def get_ai_health() -> AIHealthStatus:
    """获取当前 AI 基础底座与熔断器健康状态"""
    return ai_service.get_health()
