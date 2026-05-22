from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    grade_label: str | None = Field(default=None, max_length=40)


class ChildUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    grade_label: str | None = Field(default=None, max_length=40)
    streak_threshold: int | None = Field(default=None, ge=0, le=100)


class ChildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    grade_label: str | None = None
    streak_threshold: int = 80
    status: str
    created_at: datetime


class ChildBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
