from datetime import date, datetime, time
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id"), nullable=False, index=True)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("plans.id"), nullable=False, index=True)
    task_template_id: Mapped[UUID | None] = mapped_column(ForeignKey("task_templates.id"))
    task_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    expected_minutes: Mapped[int | None] = mapped_column(Integer)
    reward_stars: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    child_feedback: Mapped[str | None] = mapped_column(String(20))
    created_by: Mapped[str] = mapped_column(String(20), nullable=False, default="parent")
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    schedule_by: Mapped[str | None] = mapped_column(String(20))
    scheduled_start: Mapped[time | None] = mapped_column(Time(timezone=True))
    scheduled_end: Mapped[time | None] = mapped_column(Time(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    child = relationship("Child", backref="daily_tasks")
    plan = relationship("Plan", backref="daily_tasks")
    template = relationship("TaskTemplate", backref="daily_tasks")

    __table_args__ = (
        UniqueConstraint("child_id", "task_date", "task_template_id", name="uq_daily_task_template"),
    )
