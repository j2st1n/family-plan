from copy import copy as shallow_copy
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.redemption import Redemption
from app.models.reward_ledger import RewardLedger
from app.models.shop_item import ShopItem
from app.models.streak import Streak
from app.schemas.shop import ShopItemCreate, WishApprove, WishCreate
from app.services.reward_settings import calculate_discounted_star_cost, discount_label, get_discount_percent, get_or_create_reward_settings


def list_shop_items(db: Session, child_id: UUID) -> list[ShopItem]:
    child = db.get(Child, child_id)
    if child is None:
        return []
    active = list(
        db.scalars(
            select(ShopItem)
            .where(
                ((ShopItem.parent_id == child.parent_id) & (ShopItem.child_id.is_(None)) & (ShopItem.status == "active")) |
                ((ShopItem.child_id == child_id) & (ShopItem.status == "active")),
            )
            .order_by(ShopItem.created_at.desc())
        )
    )
    db.expunge_all()
    redemptions = list(
        db.scalars(
            select(Redemption).where(Redemption.child_id == child_id).order_by(Redemption.created_at.desc())
        )
    )
    settings = get_or_create_reward_settings(db, child_id)
    streak = db.scalar(select(Streak).where(Streak.child_id == child_id))
    streak_days = streak.current_days if streak else 0
    discount_percent = get_discount_percent(settings, streak_days)
    label = discount_label(settings, streak_days)
    result = []
    for red in redemptions:
        item = db.get(ShopItem, red.shop_item_id)
        if item is None:
            continue
        entry = shallow_copy(item)
        entry.redeemed_by_child = True  # type: ignore[attr-defined]
        entry.redemption_id = red.id  # type: ignore[attr-defined]
        entry.redemption_status = red.status  # type: ignore[attr-defined]
        entry.original_star_cost = red.original_star_cost  # type: ignore[attr-defined]
        entry.final_star_cost = red.final_star_cost  # type: ignore[attr-defined]
        entry.redemption_discount_percent = red.discount_percent  # type: ignore[attr-defined]
        entry.streak_days_at_redeem = red.streak_days_at_redeem  # type: ignore[attr-defined]
        result.append(entry)
    for item in active:
        item.discounted_star_cost = calculate_discounted_star_cost(item.star_cost, discount_percent)  # type: ignore[attr-defined]
        item.discount_percent = discount_percent  # type: ignore[attr-defined]
        item.streak_days = streak_days  # type: ignore[attr-defined]
        item.discount_label = label  # type: ignore[attr-defined]
    return active + result


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
    child = db.scalar(select(Child).where(Child.id == child_id).with_for_update())
    if child is None:
        raise api_error("not_found", "Child not found", 404)
    item = db.scalar(
        select(ShopItem).where(
            ShopItem.id == item_id,
            ShopItem.status == "active",
            ((ShopItem.parent_id == child.parent_id) & (ShopItem.child_id.is_(None))) |
            (ShopItem.child_id == child_id),
        ).with_for_update()
    )
    if item is None:
        raise api_error("not_found", "Item not found", 404)
    if item.stock is not None and item.stock <= 0:
        raise api_error("conflict", "Out of stock", 409)

    settings = get_or_create_reward_settings(db, child_id)
    streak = db.scalar(select(Streak).where(Streak.child_id == child_id))
    streak_days = streak.current_days if streak else 0
    discount_percent = get_discount_percent(settings, streak_days)
    paid_amount = calculate_discounted_star_cost(item.star_cost, discount_percent)
    total = db.scalar(select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00"))).where(RewardLedger.child_id == child_id))
    if Decimal(total or "0.00") < paid_amount:
        raise api_error("conflict", "Not enough stars", 409)

    red = Redemption(
        child_id=child_id,
        shop_item_id=item.id,
        original_star_cost=item.star_cost,
        final_star_cost=paid_amount,
        discount_percent=discount_percent,
        streak_days_at_redeem=streak_days,
    )
    db.add(red)
    db.flush()
    db.add(RewardLedger(child_id=child_id, source_type="shop_redeem", source_id=red.id, stars_delta=-paid_amount, reason=item.title))
    if item.stock is not None:
        remaining = item.stock - 1
        item.stock = remaining
        if remaining <= 0:
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
    reds = list(
        db.scalars(
            select(Redemption)
            .join(ShopItem, Redemption.shop_item_id == ShopItem.id)
            .where(ShopItem.parent_id == parent_id)
            .order_by(Redemption.created_at.desc())
        )
    )
    result = []
    for red in reds:
        item = db.get(ShopItem, red.shop_item_id)
        if item:
            item.redemption_id = red.id  # type: ignore[attr-defined]
            item.redemption_status = red.status  # type: ignore[attr-defined]
            item.original_star_cost = red.original_star_cost  # type: ignore[attr-defined]
            item.final_star_cost = red.final_star_cost  # type: ignore[attr-defined]
            item.redemption_discount_percent = red.discount_percent  # type: ignore[attr-defined]
            item.streak_days_at_redeem = red.streak_days_at_redeem  # type: ignore[attr-defined]
            result.append(item)
    return result


def fulfill_item(db: Session, redemption_id: UUID, parent_id: UUID) -> ShopItem:
    red = db.scalar(select(Redemption).where(Redemption.id == redemption_id))
    if red is None:
        raise api_error("not_found", "Redemption not found", 404)
    item = db.get(ShopItem, red.shop_item_id)
    if item is None or item.parent_id != parent_id:
        raise api_error("not_found", "Item not found", 404)
    if red.status != "pending":
        raise api_error("conflict", "Already fulfilled", 409)
    red.status = "fulfilled"
    red.fulfilled_at = datetime.now(UTC)
    db.commit()
    db.refresh(item)
    return item
