from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChildStreakFreeze(Base):
    __tablename__ = "child_streak_freezes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("children.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    available_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    star_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("5.00"), server_default="5.00"
    )
    max_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=2, server_default="2")
    monthly_grant: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    last_granted_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    child = relationship("Child", backref="streak_freeze", uselist=False)

    __table_args__ = (
        CheckConstraint("available_count >= 0", name="chk_freeze_available_count_non_negative"),
        CheckConstraint("star_cost >= 0.01", name="chk_freeze_star_cost_positive"),
        CheckConstraint("max_limit >= 1", name="chk_freeze_max_limit_ge_1"),
    )
