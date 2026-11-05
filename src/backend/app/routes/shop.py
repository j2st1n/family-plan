from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_child, get_current_parent
from app.core.errors import api_error
from app.db.session import get_db
from app.models.child import Child
from app.models.child_device import ChildDevice
from app.models.parent import Parent
from app.schemas.shop import (
    ChildFreezeResponse,
    FreezeAdjustRequest,
    FreezeLogItem,
    FreezeSettingsUpdate,
    FreezeUsageItem,
    ShopItemCreate,
    ShopItemResponse,
    WishApprove,
    WishCreate,
)
from app.services.daily_tasks import _get_stars_total
from app.services.event_hub import event_hub
from app.services.shop import (
    _verify_child_for_parent,
    approve_wish,
    create_shop_item,
    create_wish,
    fulfill_item,
    list_parent_shop,
    list_redemptions,
    list_shop_items,
    redeem_item,
    remove_shop_item,
    update_child_wish,
    update_parent_item,
)
from app.services.streak_freeze import (
    adjust_streak_freeze_balance,
    get_freeze_logs,
    get_freeze_usages,
    get_or_create_streak_freeze,
    purchase_streak_freeze,
    update_freeze_rules,
)


def _make_child_freeze_response(db: Session, child_id: UUID) -> ChildFreezeResponse:
    freeze = get_or_create_streak_freeze(db, child_id)
    usages = get_freeze_usages(db, child_id)
    history = get_freeze_logs(db, child_id)
    total_stars = _get_stars_total(db, child_id)
    can_purchase = True
    reason = None
    if freeze.available_count >= freeze.max_limit:
        can_purchase = False
        reason = "max_limit_reached"
    elif total_stars < freeze.star_cost:
        can_purchase = False
        reason = "insufficient_stars"

    return ChildFreezeResponse(
        child_id=child_id,
        available_count=freeze.available_count,
        max_limit=freeze.max_limit,
        star_cost=freeze.star_cost,
        monthly_grant=freeze.monthly_grant,
        last_granted_month=freeze.last_granted_month,
        can_purchase=can_purchase,
        can_purchase_reason=reason,
        usages=[FreezeUsageItem.model_validate(u, from_attributes=True) for u in usages],
        history=[FreezeLogItem.model_validate(h, from_attributes=True) for h in history],
    )


router = APIRouter(prefix="/shop", tags=["shop"])
child_router = APIRouter(prefix="/child/shop", tags=["child shop"])


@router.get("/children/{child_id}/freeze", response_model=ChildFreezeResponse)
def get_parent_child_freeze(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    _verify_child_for_parent(db, child_id, parent.id)
    return _make_child_freeze_response(db, child_id)


@router.patch("/children/{child_id}/freeze/adjust", response_model=ChildFreezeResponse)
@router.post("/children/{child_id}/freeze/adjust", response_model=ChildFreezeResponse)
def adjust_child_freeze(
    child_id: UUID,
    payload: FreezeAdjustRequest,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    _verify_child_for_parent(db, child_id, parent.id)
    adjust_streak_freeze_balance(
        db, child_id, delta=payload.delta, reason=payload.reason, operator="parent"
    )
    event_hub.publish(parent.id, "shop", "freeze_adjusted", child_id)
    return _make_child_freeze_response(db, child_id)


@router.put("/children/{child_id}/freeze/settings", response_model=ChildFreezeResponse)
@router.patch("/children/{child_id}/freeze/settings", response_model=ChildFreezeResponse)
@router.put("/children/{child_id}/freeze", response_model=ChildFreezeResponse)
@router.patch("/children/{child_id}/freeze", response_model=ChildFreezeResponse)
def update_child_freeze_settings(
    child_id: UUID,
    payload: FreezeSettingsUpdate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    _verify_child_for_parent(db, child_id, parent.id)
    update_freeze_rules(
        db,
        child_id,
        star_cost=payload.star_cost,
        max_limit=payload.max_limit,
        monthly_grant=payload.monthly_grant,
    )
    event_hub.publish(parent.id, "shop", "freeze_settings_updated", child_id)
    return _make_child_freeze_response(db, child_id)


@router.post("/children/{child_id}/freeze/purchase", response_model=ChildFreezeResponse)
def purchase_child_freeze_by_parent(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    _verify_child_for_parent(db, child_id, parent.id)
    purchase_streak_freeze(db, child_id, operator="parent")
    event_hub.publish(parent.id, "shop", "freeze_purchased", child_id)
    return _make_child_freeze_response(db, child_id)


@router.get("/items", response_model=list[ShopItemResponse])
def parent_shop_items(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return [ShopItemResponse.model_validate(i) for i in list_parent_shop(db, parent.id)]


@router.post("/items", response_model=ShopItemResponse)
def add_shop_item(
    payload: ShopItemCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    item = create_shop_item(db, parent.id, payload)
    event_hub.publish(parent.id, "shop", "item_created", item.child_id)
    return ShopItemResponse.model_validate(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_shop_item(
    item_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    remove_shop_item(db, item_id, parent.id)
    event_hub.publish(parent.id, "shop", "item_deleted")


@router.patch("/items/{item_id}", response_model=ShopItemResponse)
def edit_shop_item(
    payload: ShopItemCreate,
    item_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    item = update_parent_item(db, item_id, parent.id, payload)
    event_hub.publish(parent.id, "shop", "item_updated", item.child_id)
    return ShopItemResponse.model_validate(item)


@router.patch("/items/{item_id}/approve", response_model=ShopItemResponse)
def approve(
    payload: WishApprove,
    item_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    item = approve_wish(db, item_id, parent.id, payload)
    event_hub.publish(parent.id, "shop", "wish_approved", item.child_id)
    return ShopItemResponse.model_validate(item)


@router.get("/redemptions", response_model=list[ShopItemResponse])
def parent_redemptions(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return [ShopItemResponse.model_validate(i) for i in list_redemptions(db, parent.id)]


@router.patch("/redemptions/{redemption_id}/fulfill", response_model=ShopItemResponse)
def fulfill(
    redemption_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    item = fulfill_item(db, redemption_id, parent.id)
    event_hub.publish(parent.id, "shop", "redemption_fulfilled", item.child_id)
    return ShopItemResponse.model_validate(item)


@child_router.get("/items", response_model=list[ShopItemResponse])
def child_shop_items(
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    return [ShopItemResponse.model_validate(i) for i in list_shop_items(db, child.id)]


@child_router.post("/items/{item_id}/redeem", response_model=ShopItemResponse)
def redeem(
    item_id: UUID,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    item = redeem_item(db, item_id, child.id)
    event_hub.publish(child.parent_id, "shop", "item_redeemed", child.id)
    return ShopItemResponse.model_validate(item)


@child_router.post("/wishes", response_model=ShopItemResponse)
def make_wish(
    payload: WishCreate,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    if child.parent is None or len(child.parent.children) == 0:
        raise api_error("not_found", "Parent not found", 404)
    item = create_wish(db, child.id, child.parent_id, payload)
    event_hub.publish(child.parent_id, "shop", "wish_created", child.id)
    return ShopItemResponse.model_validate(item)


@child_router.patch("/wishes/{item_id}", response_model=ShopItemResponse)
def edit_wish(
    payload: WishCreate,
    item_id: UUID,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    item = update_child_wish(db, item_id, child.id, payload)
    event_hub.publish(child.parent_id, "shop", "wish_updated", child.id)
    return ShopItemResponse.model_validate(item)


@child_router.get("/freeze", response_model=ChildFreezeResponse)
def get_child_freeze(
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    child, _ = child_device
    return _make_child_freeze_response(db, child.id)


@child_router.post("/freeze/purchase", response_model=ChildFreezeResponse)
def purchase_child_freeze(
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
) -> ChildFreezeResponse:
    child, _ = child_device
    purchase_streak_freeze(db, child.id, operator="child")
    event_hub.publish(child.parent_id, "shop", "freeze_purchased", child.id)
    return _make_child_freeze_response(db, child.id)
