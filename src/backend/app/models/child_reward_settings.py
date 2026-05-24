from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


DEFAULT_STREAK_DISCOUNT_TIERS = [
    {"days": 7, "discount_percent": 90},
    {"days": 14, "discount_percent": 85},
    {"days": 21, "discount_percent": 80},
]


def default_discount_tiers() -> list[dict[str, int]]:
    return [tier.copy() for tier in DEFAULT_STREAK_DISCOUNT_TIERS]


class ChildRewardSettings(Base):
    __tablename__ = "child_reward_settings"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    streak_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    streak_discount_enabled: Mapped[bool] = mapped_column(nullable=False, default=True)
    streak_discount_tiers: Mapped[list[dict[str, int]]] = mapped_column(JSONB, nullable=False, default=default_discount_tiers)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    child = relationship("Child", back_populates="reward_settings")
