from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.child_reward_settings import DEFAULT_STREAK_DISCOUNT_TIERS


class StreakDiscountTier(BaseModel):
    days: int
    discount_percent: int = Field(ge=1, le=100)


class RewardSettingsUpdate(BaseModel):
    streak_threshold: int = Field(ge=1, le=100)
    streak_discount_enabled: bool = True
    streak_discount_tiers: list[StreakDiscountTier]

    @field_validator("streak_discount_tiers")
    @classmethod
    def validate_tiers(cls, tiers: list[StreakDiscountTier]) -> list[StreakDiscountTier]:
        if not tiers:
            raise ValueError("discount tiers must include at least one tier")
        days = [tier.days for tier in tiers]
        if days != sorted(days):
            raise ValueError("discount tiers must be sorted by days")
        if len(days) != len(set(days)):
            raise ValueError("discount tiers must not repeat days")
        if any(day < 7 or day % 7 != 0 for day in days):
            raise ValueError("discount tier days must be multiples of 7")
        percents = [tier.discount_percent for tier in tiers]
        if percents != sorted(percents, reverse=True):
            raise ValueError("longer streak discounts must not be higher than earlier tiers")
        return tiers


class RewardSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: UUID
    streak_threshold: int
    streak_discount_enabled: bool
    streak_discount_tiers: list[StreakDiscountTier]


def default_reward_settings_payload() -> RewardSettingsUpdate:
    return RewardSettingsUpdate(
        streak_threshold=80,
        streak_discount_enabled=True,
        streak_discount_tiers=[StreakDiscountTier(**tier) for tier in DEFAULT_STREAK_DISCOUNT_TIERS],
    )
