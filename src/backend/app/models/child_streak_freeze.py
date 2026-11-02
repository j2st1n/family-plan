from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChildStreakFreeze(Base):
    __tablename__ = "child_streak_freezes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    available_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_granted_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    child = relationship("Child", backref="streak_freeze", uselist=False)

    __table_args__ = (
        CheckConstraint("available_count >= 0", name="chk_freeze_available_count_non_negative"),
    )
