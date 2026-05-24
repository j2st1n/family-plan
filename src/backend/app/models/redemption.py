from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Redemption(Base):
    __tablename__ = "redemptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id"), nullable=False, index=True)
    shop_item_id: Mapped[UUID] = mapped_column(ForeignKey("shop_items.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    original_star_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    final_star_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    discount_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    streak_days_at_redeem: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child = relationship("Child", backref="redemptions")
    item = relationship("ShopItem", backref="redemptions")
