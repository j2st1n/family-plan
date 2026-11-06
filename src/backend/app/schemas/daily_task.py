from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.child import ChildBrief


class DailyTaskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    title: str
    description: str | None = None
    expected_minutes: int | None = None
    reward_stars: int | None
    actual_seconds: int | None = None
    completion_version: int = 0
    sort_order: int
    status: str
    require_approval: bool = False
    submitted_at: datetime | None = None
    scheduled_start: str | None = None
    scheduled_end: str | None = None
    created_by: str = "parent"
    approved: bool = True
    schedule_by: str | None = None

    @field_validator("scheduled_start", "scheduled_end", mode="before")
    @classmethod
    def coerce_time(cls, v: time | str | None) -> str | None:
        if v is None:
            return None
        if isinstance(v, time):
            return v.strftime("%H:%M")
        return v


class RewardSummary(BaseModel):
    stars_total: Decimal
    current_streak_days: int
    streak_freeze_count: int = 0
    is_on_vacation: bool = False


class ChildTodayResponse(BaseModel):
    date: date
    child: ChildBrief
    tasks: list[DailyTaskItem]
    rewards: RewardSummary


class TaskCompleteRequest(BaseModel):
    feedback: str | None = Field(default=None, max_length=20)
    actual_seconds: int | None = Field(default=None, ge=0, le=86400, strict=True)
    operation_id: UUID | None = None
    expected_version: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def timed_completion_identity(self):
        if self.actual_seconds is not None and (self.operation_id is None or self.expected_version is None):
            raise ValueError("Timed completion requires operation_id and expected_version")
        return self


class TaskCompleteResponse(BaseModel):
    task_id: UUID
    status: str
    stars_awarded: int
    current_streak_days: int


class ManualTaskItem(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    expected_minutes: int | None = Field(default=None, ge=1)
    reward_stars: int = Field(default=1, ge=1, le=99)
    require_approval: bool = False
    scheduled_start: str | None = None
    scheduled_end: str | None = None
    approved: bool | None = None

    @field_validator("scheduled_start", "scheduled_end")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value:
            time.fromisoformat(value)
        return value


class ManualDailyTasksCreate(BaseModel):
    task_date: date
    tasks: list[ManualTaskItem] = Field(min_length=1)


class ParentDailyTasksResponse(BaseModel):
    task_date: date
    tasks: list[DailyTaskItem]
    rewards: RewardSummary


class ChildTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    expected_minutes: int = Field(ge=1)
    scheduled_start: str | None = None
    scheduled_end: str | None = None


class ChildScheduleRequest(BaseModel):
    scheduled_start: str
    scheduled_end: str
