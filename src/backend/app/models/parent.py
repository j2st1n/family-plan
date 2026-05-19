from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Parent(Base):
    __tablename__ = "parents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    wechat_openid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(80))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    children = relationship("Child", back_populates="parent")
