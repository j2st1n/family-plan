from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChildStreakFreezeUsage(Base):
    __tablename__ = "child_streak_freeze_usages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    used_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(String(100), nullable=True, default="auto_deduct_missed_day")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child = relationship("Child", backref="freeze_usages")

    __table_args__ = (
        UniqueConstraint("child_id", "used_date", name="uq_child_streak_freeze_usage_date"),
        Index("ix_child_streak_freeze_usages_lookup", "child_id", "used_date"),
    )
