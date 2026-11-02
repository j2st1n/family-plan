from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FreezeUsageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    used_date: date
    reason: str | None = None
    created_at: datetime


class FreezeLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    event_type: str
    delta: int
    balance_after: int
    target_date: date | None = None
    reason: str | None = None
    operator: str = "system"
    created_at: datetime


class ChildFreezeResponse(BaseModel):
    child_id: UUID
    available_count: int
    max_limit: int = 2
    star_cost: Decimal = Decimal("5.00")
    monthly_grant: int = 1
    last_granted_month: str | None = None
    can_purchase: bool = True
    can_purchase_reason: str | None = None
    usages: list[FreezeUsageItem] = []
    history: list[FreezeLogItem] = []


class FreezeAdjustRequest(BaseModel):
    delta: int = Field(description="变动张数，正数为增加，负数为扣除")
    reason: str | None = Field(default=None, max_length=200)


class FreezeSettingsUpdate(BaseModel):
    star_cost: Decimal | None = Field(default=None, ge=Decimal("0.01"), max_digits=10, decimal_places=2)
    max_limit: int | None = Field(default=None, ge=1, le=100)
    monthly_grant: int | None = Field(default=None, ge=0, le=10)


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
