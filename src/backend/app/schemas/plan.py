from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TaskTemplateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    expected_minutes: int | None = Field(default=None, ge=1)
    weekdays: list[int] = Field(default_factory=list)
    sort_order: int = Field(default=0)
    reward_stars: int = Field(default=1, ge=0)


class TaskTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    title: str
    description: str | None = None
    expected_minutes: int | None = None
    weekdays: list[int] = []
    sort_order: int
    reward_stars: int
    status: str
    created_at: datetime
    updated_at: datetime


class PlanCreate(BaseModel):
    child_id: UUID
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    start_date: date
    end_date: date | None = None
    tasks: list[TaskTemplateCreate] = Field(default_factory=list)


class PlanBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    title: str
    status: str
    created_at: datetime


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_id: UUID
    child_id: UUID
    title: str
    description: str | None = None
    start_date: date
    end_date: date | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    tasks: list[TaskTemplateResponse] = Field(default_factory=list, validation_alias="task_templates")
