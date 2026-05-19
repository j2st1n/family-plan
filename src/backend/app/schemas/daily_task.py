from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.child import ChildBrief


class DailyTaskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    expected_minutes: int | None = None
    reward_stars: int
    sort_order: int
    status: str
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
    stars_total: int
    current_streak_days: int


class ChildTodayResponse(BaseModel):
    date: date
    child: ChildBrief
    tasks: list[DailyTaskItem]
    rewards: RewardSummary


class TaskCompleteRequest(BaseModel):
    feedback: str | None = Field(default=None, max_length=20)


class TaskCompleteResponse(BaseModel):
    task_id: UUID
    status: str
    stars_awarded: int
    current_streak_days: int


class ManualTaskItem(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    expected_minutes: int | None = Field(default=None, ge=1)
    reward_stars: int = Field(default=1, ge=0, le=5)
    scheduled_start: str | None = None
    scheduled_end: str | None = None
    approved: bool | None = None


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
    reward_stars: int = Field(default=1, ge=1, le=5)
    scheduled_start: str | None = None
    scheduled_end: str | None = None


class ChildScheduleRequest(BaseModel):
    scheduled_start: str
    scheduled_end: str
