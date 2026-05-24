from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ShopItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    star_cost: Decimal = Field(ge=Decimal("0.01"), max_digits=10, decimal_places=2)
    child_id: UUID | None = None
    stock: int | None = Field(default=None, ge=0)


class ShopItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_id: UUID
    child_id: UUID | None = None
    title: str
    description: str | None = None
    star_cost: Decimal
    discounted_star_cost: Decimal | None = None
    discount_percent: int | None = None
    streak_days: int | None = None
    discount_label: str | None = None
    status: str
    stock: int | None = None
    fulfilled_at: datetime | None = None
    redeemed_by_child: bool = False
    redemption_id: UUID | None = None
    redemption_status: str | None = None
    original_star_cost: Decimal | None = None
    final_star_cost: Decimal | None = None
    redemption_discount_percent: int | None = None
    streak_days_at_redeem: int | None = None
    created_by: str
    created_at: datetime


class WishCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


class WishApprove(BaseModel):
    star_cost: Decimal = Field(ge=Decimal("0.01"), max_digits=10, decimal_places=2)
