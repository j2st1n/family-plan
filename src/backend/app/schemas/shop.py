from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ShopItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    star_cost: int = Field(ge=1)
    child_id: UUID | None = None


class ShopItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_id: UUID
    child_id: UUID | None = None
    title: str
    description: str | None = None
    star_cost: int
    status: str
    created_by: str
    created_at: datetime


class WishCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


class WishApprove(BaseModel):
    star_cost: int = Field(ge=1)
