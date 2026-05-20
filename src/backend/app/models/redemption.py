from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Redemption(Base):
    __tablename__ = "redemptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id"), nullable=False, index=True)
    shop_item_id: Mapped[UUID] = mapped_column(ForeignKey("shop_items.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    child = relationship("Child", backref="redemptions")
    item = relationship("ShopItem", backref="redemptions")
