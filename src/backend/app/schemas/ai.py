from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class ParsedTaskItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=160, description="任务标题，如：练琴20分钟")
    description: Optional[str] = Field(default=None, max_length=2000, description="任务说明")
    expected_minutes: int = Field(default=20, ge=1, le=240, description="预估时长(分钟)")
    reward_stars: int = Field(default=1, ge=0, le=5, description="奖励星星数")
    category: str = Field(default="学习思考", description="四维习惯分类：学习思考, 体育运动, 生活自理, 家务协助")
    start: Optional[str] = Field(default=None, description="计划开始时间 (HH:MM)")
    end: Optional[str] = Field(default=None, description="计划结束时间 (HH:MM)")
    scheduled_start: Optional[str] = Field(default=None, description="别名开始时间 (HH:MM)")
    scheduled_end: Optional[str] = Field(default=None, description="别名结束时间 (HH:MM)")
    require_approval: bool = Field(default=False, description="是否需要家长审核确认")

    @model_validator(mode="after")
    def sync_time_aliases(self) -> "ParsedTaskItem":
        # Keep start/end and scheduled_start/scheduled_end in sync
        if self.start and not self.scheduled_start:
            self.scheduled_start = self.start
        elif self.scheduled_start and not self.start:
            self.start = self.scheduled_start

        if self.end and not self.scheduled_end:
            self.scheduled_end = self.end
        elif self.scheduled_end and not self.end:
            self.end = self.scheduled_end

        # Normalize category
        cat_map = {
            "learning": "学习思考",
            "sport": "体育运动",
            "habit": "生活自理",
            "chore": "家务协助",
            "学习": "学习思考",
            "思考": "学习思考",
            "运动": "体育运动",
            "健身": "体育运动",
            "自理": "生活自理",
            "生活": "生活自理",
            "家务": "家务协助",
        }
        if self.category in cat_map:
            self.category = cat_map[self.category]
        elif self.category not in {"学习思考", "体育运动", "生活自理", "家务协助"}:
            self.category = "学习思考"

        return self


class CopilotParseRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000, description="家长口语录入文本")
    child_id: Optional[UUID] = Field(default=None, description="目标孩子ID (可选)")
    target_date: Optional[date] = Field(default=None, description="目标任务日期，缺省为今日")


class CopilotParseResult(BaseModel):
    tasks: list[ParsedTaskItem] = Field(default_factory=list, description="解析出的任务列表")
    raw_summary: str = Field(..., description="AI 意图理解与友好反馈话术")
    resolved_date: date = Field(default_factory=date.today, description="识别出的目标任务日期")
    is_degraded: bool = Field(default=False, description="是否触发离线规则降级")


class AIHealthStatus(BaseModel):
    status: str = Field(..., description="healthy, degraded, disabled")
    backend: str = Field(..., description="ollama, deepseek, openai, local_fallback")
    circuit_breaker_state: str = Field(..., description="closed, open, half_open")
    timeout_seconds: float = Field(default=2.5, description="超时时间阈值(秒)")


class AISettingsResponse(BaseModel):
    provider: str = Field(default="deepseek", description="模型提供商：deepseek, openai, ollama, custom")
    base_url: str = Field(default="", description="API 基础地址")
    model: str = Field(default="deepseek-chat", description="模型标识")
    has_api_key: bool = Field(default=False, description="是否已配置 API Key")
    api_key_masked: str = Field(default="", description="严格脱敏打码的 API Key (如 sk-****3a8f)")
    is_enabled: bool = Field(default=True, description="是否启用 AI Copilot 助手")
    active_mode: str = Field(default="纯离线规则", description="当前运行模式标签：DeepSeek, 本地 Ollama, 纯离线规则 等")


class AISettingsUpdateRequest(BaseModel):
    provider: Optional[str] = Field(default="deepseek", max_length=32)
    base_url: Optional[str] = Field(default=None, max_length=255)
    api_key: Optional[str] = Field(default=None, max_length=512, description="明文 Key 或留空保持原 Key")
    model: Optional[str] = Field(default="deepseek-chat", max_length=64)
    is_enabled: Optional[bool] = Field(default=True)
    clear_api_key: Optional[bool] = Field(default=False, description="显式清除现有 API Key")


class AITestConnectionRequest(BaseModel):
    provider: Optional[str] = Field(default=None, max_length=32)
    base_url: Optional[str] = Field(default=None, max_length=255)
    api_key: Optional[str] = Field(default=None, max_length=512)
    model: Optional[str] = Field(default=None, max_length=64)


class AITestConnectionResponse(BaseModel):
    success: bool = Field(..., description="是否连通成功")
    latency_ms: Optional[int] = Field(default=None, description="毫秒耗时")
    message: str = Field(..., description="友好结果提示")
    status_code: Optional[int] = Field(default=None, description="HTTP 状态码")
