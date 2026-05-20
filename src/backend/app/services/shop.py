from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.redemption import Redemption
from app.models.reward_ledger import RewardLedger
from app.models.shop_item import ShopItem
from app.schemas.shop import ShopItemCreate, WishApprove, WishCreate


def list_shop_items(db: Session, child_id: UUID) -> list[ShopItem]:
    child = db.get(Child, child_id)
    if child is None:
        return []
    redeemed_ids = set(
        db.scalars(
            select(Redemption.shop_item_id).where(Redemption.child_id == child_id)
        )
    )
    active = list(
        db.scalars(
            select(ShopItem)
            .where(
                ((ShopItem.parent_id == child.parent_id) & (ShopItem.child_id.is_(None)) & (ShopItem.status == "active") & (~ShopItem.id.in_(redeemed_ids))) |
                ((ShopItem.child_id == child_id) & (ShopItem.status == "active") & (~ShopItem.id.in_(redeemed_ids))),
            )
            .order_by(ShopItem.created_at.desc())
        )
    )
    redeemed = list(
        db.scalars(
            select(ShopItem).where(ShopItem.id.in_(redeemed_ids)).order_by(ShopItem.created_at.desc())
        )
    ) if redeemed_ids else []
    for item in redeemed:
        item.redeemed_by_child = True  # type: ignore[attr-defined]
    return active + redeemed


def list_parent_shop(db: Session, parent_id: UUID) -> list[ShopItem]:
    return list(
        db.scalars(
            select(ShopItem)
            .where(ShopItem.parent_id == parent_id)
            .order_by(ShopItem.created_at.desc())
        )
    )


def create_shop_item(db: Session, parent_id: UUID, data: ShopItemCreate) -> ShopItem:
    item = ShopItem(parent_id=parent_id, title=data.title, description=data.description, star_cost=data.star_cost, child_id=data.child_id, stock=data.stock, created_by="parent")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_wish(db: Session, child_id: UUID, parent_id: UUID, data: WishCreate) -> ShopItem:
    item = ShopItem(parent_id=parent_id, child_id=child_id, title=data.title, description=data.description, star_cost=0, status="pending", created_by="child")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def approve_wish(db: Session, item_id: UUID, parent_id: UUID, data: WishApprove) -> ShopItem:
    item = db.scalar(select(ShopItem).where(ShopItem.id == item_id, ShopItem.parent_id == parent_id))
    if item is None or item.status != "pending":
        raise api_error("not_found", "Wish not found or not pending", 404)
    item.star_cost = data.star_cost
    item.status = "active"
    db.commit()
    db.refresh(item)
    return item


def redeem_item(db: Session, item_id: UUID, child_id: UUID) -> ShopItem:
    child = db.get(Child, child_id)
    if child is None:
        raise api_error("not_found", "Child not found", 404)
    item = db.scalar(
        select(ShopItem).where(
            ShopItem.id == item_id,
            ShopItem.status == "active",
            ((ShopItem.parent_id == child.parent_id) & (ShopItem.child_id.is_(None))) |
            (ShopItem.child_id == child_id),
        )
    )
    if item is None:
        raise api_error("not_found", "Item not found", 404)
    if item.stock is not None and item.stock <= 0:
        raise api_error("conflict", "Out of stock", 409)

    total = db.scalar(select(func.coalesce(func.sum(RewardLedger.stars_delta), 0)).where(RewardLedger.child_id == child_id))
    if (int(total or 0)) < item.star_cost:
        raise api_error("conflict", "Not enough stars", 409)

    red = Redemption(child_id=child_id, shop_item_id=item.id)
    db.add(red)
    db.flush()
    db.add(RewardLedger(child_id=child_id, source_type="shop_redeem", source_id=red.id, stars_delta=-item.star_cost, reason=item.title))
    if item.stock is not None:
        item.stock -= 1
    if item.stock is None or (item.stock is not None and item.stock <= 0):
        item.status = "redeemed"
    db.commit()
    db.refresh(item)
    return item


def remove_shop_item(db: Session, item_id: UUID, parent_id: UUID) -> None:
    item = db.scalar(select(ShopItem).where(ShopItem.id == item_id, ShopItem.parent_id == parent_id))
    if item is None:
        raise api_error("not_found", "Item not found", 404)
    item.status = "removed"
    db.commit()


def update_parent_item(db: Session, item_id: UUID, parent_id: UUID, data: ShopItemCreate) -> ShopItem:
    item = db.scalar(select(ShopItem).where(ShopItem.id == item_id, ShopItem.parent_id == parent_id))
    if item is None:
        raise api_error("not_found", "Item not found", 404)
    item.title = data.title
    item.description = data.description
    item.star_cost = data.star_cost
    item.stock = data.stock
    item.status = "active"
    db.commit()
    db.refresh(item)
    return item


def update_child_wish(db: Session, item_id: UUID, child_id: UUID, data: WishCreate) -> ShopItem:
    item = db.scalar(select(ShopItem).where(ShopItem.id == item_id, ShopItem.child_id == child_id, ShopItem.status == "pending"))
    if item is None:
        raise api_error("not_found", "Wish not found or not pending", 404)
    item.title = data.title
    item.description = data.description
    db.commit()
    db.refresh(item)
    return item


def list_redemptions(db: Session, parent_id: UUID) -> list[ShopItem]:
    ids = db.scalars(
        select(Redemption.shop_item_id)
        .join(ShopItem, Redemption.shop_item_id == ShopItem.id)
        .where(ShopItem.parent_id == parent_id)
    ).all()
    if not ids:
        return []
    return list(
        db.scalars(
            select(ShopItem)
            .where(ShopItem.id.in_(set(ids)))
            .order_by(ShopItem.updated_at.desc())
        )
    )


def fulfill_item(db: Session, item_id: UUID, parent_id: UUID) -> ShopItem:
    item = db.scalar(select(ShopItem).where(ShopItem.id == item_id, ShopItem.parent_id == parent_id))
    if item is None or item.status not in ("redeemed",):
        raise api_error("not_found", "Item not found or not redeemed", 404)
    item.status = "fulfilled"
    item.fulfilled_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item
