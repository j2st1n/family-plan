from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_reward_settings import ChildRewardSettings, default_discount_tiers
from app.schemas.reward_settings import RewardSettingsUpdate

STAR_QUANT = Decimal("0.01")


def get_or_create_reward_settings(db: Session, child_id: UUID) -> ChildRewardSettings:
    settings = db.scalar(select(ChildRewardSettings).where(ChildRewardSettings.child_id == child_id))
    if settings is not None:
        return settings
    child = db.get(Child, child_id)
    if child is None:
        raise api_error("not_found", "Child not found", 404)
    settings = ChildRewardSettings(
        child_id=child_id,
        streak_threshold=child.streak_threshold or 80,
        streak_discount_enabled=True,
        streak_discount_tiers=default_discount_tiers(),
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_reward_settings(db: Session, child_id: UUID, data: RewardSettingsUpdate) -> ChildRewardSettings:
    settings = get_or_create_reward_settings(db, child_id)
    settings.streak_threshold = data.streak_threshold
    settings.streak_discount_enabled = data.streak_discount_enabled
    settings.streak_discount_tiers = [tier.model_dump() for tier in data.streak_discount_tiers]
    child = db.get(Child, child_id)
    if child is not None:
        child.streak_threshold = data.streak_threshold
    db.commit()
    db.refresh(settings)
    return settings


def get_discount_percent(settings: ChildRewardSettings, streak_days: int) -> int:
    if not settings.streak_discount_enabled:
        return 100
    tiers = sorted(settings.streak_discount_tiers, key=lambda tier: tier["days"], reverse=True)
    for tier in tiers:
        if streak_days >= tier["days"]:
            return int(tier["discount_percent"])
    return 100


def get_discount_tier_days(settings: ChildRewardSettings, streak_days: int) -> int | None:
    if not settings.streak_discount_enabled:
        return None
    tiers = sorted(settings.streak_discount_tiers, key=lambda tier: tier["days"], reverse=True)
    for tier in tiers:
        if streak_days >= tier["days"]:
            return int(tier["days"])
    return None


def calculate_discounted_star_cost(star_cost: Decimal, discount_percent: int) -> Decimal:
    discounted = star_cost * Decimal(discount_percent) / Decimal(100)
    rounded = discounted.quantize(STAR_QUANT, rounding=ROUND_HALF_UP)
    return max(STAR_QUANT, rounded)


def discount_label(settings: ChildRewardSettings, streak_days: int) -> str:
    tier_days = get_discount_tier_days(settings, streak_days)
    if tier_days is not None:
        percent = get_discount_percent(settings, streak_days)
        return f"连续打卡 {tier_days} 天，支付 {percent}%"
    first_tier = min(settings.streak_discount_tiers, key=lambda tier: tier["days"])
    return f"连续打卡 {first_tier['days']} 天可享 {first_tier['discount_percent']}%"
