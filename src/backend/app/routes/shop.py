from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_child, get_current_parent
from app.core.errors import api_error
from app.db.session import get_db
from app.models.child import Child
from app.models.child_device import ChildDevice
from app.models.parent import Parent
from app.schemas.shop import ShopItemCreate, ShopItemResponse, WishApprove, WishCreate
from app.services.shop import approve_wish, create_shop_item, create_wish, fulfill_item, list_parent_shop, list_redemptions, list_shop_items, redeem_item, remove_shop_item, update_child_wish, update_parent_item

router = APIRouter(prefix="/shop", tags=["shop"])
child_router = APIRouter(prefix="/child/shop", tags=["child shop"])


@router.get("/items", response_model=list[ShopItemResponse])
def parent_shop_items(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return [ShopItemResponse.model_validate(i) for i in list_parent_shop(db, parent.id)]


@router.post("/items", response_model=ShopItemResponse)
def add_shop_item(payload: ShopItemCreate, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return ShopItemResponse.model_validate(create_shop_item(db, parent.id, payload))


@router.delete("/items/{item_id}", status_code=204)
def delete_shop_item(item_id: UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    remove_shop_item(db, item_id, parent.id)


@router.patch("/items/{item_id}", response_model=ShopItemResponse)
def edit_shop_item(payload: ShopItemCreate, item_id: UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return ShopItemResponse.model_validate(update_parent_item(db, item_id, parent.id, payload))


@router.patch("/items/{item_id}/approve", response_model=ShopItemResponse)
def approve(payload: WishApprove, item_id: UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return ShopItemResponse.model_validate(approve_wish(db, item_id, parent.id, payload))


@router.get("/redemptions", response_model=list[ShopItemResponse])
def parent_redemptions(parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return [ShopItemResponse.model_validate(i) for i in list_redemptions(db, parent.id)]


@router.patch("/redemptions/{redemption_id}/fulfill", response_model=ShopItemResponse)
def fulfill(redemption_id: UUID, parent: Parent = Depends(get_current_parent), db: Session = Depends(get_db)):
    return ShopItemResponse.model_validate(fulfill_item(db, redemption_id, parent.id))


@child_router.get("/items", response_model=list[ShopItemResponse])
def child_shop_items(child_device: tuple[Child, ChildDevice] = Depends(get_current_child), db: Session = Depends(get_db)):
    child, _ = child_device
    return [ShopItemResponse.model_validate(i) for i in list_shop_items(db, child.id)]


@child_router.post("/items/{item_id}/redeem", response_model=ShopItemResponse)
def redeem(item_id: UUID, child_device: tuple[Child, ChildDevice] = Depends(get_current_child), db: Session = Depends(get_db)):
    child, _ = child_device
    return ShopItemResponse.model_validate(redeem_item(db, item_id, child.id))


@child_router.post("/wishes", response_model=ShopItemResponse)
def make_wish(payload: WishCreate, child_device: tuple[Child, ChildDevice] = Depends(get_current_child), db: Session = Depends(get_db)):
    child, _ = child_device
    if child.parent is None or len(child.parent.children) == 0:
        raise api_error("not_found", "Parent not found", 404)
    return ShopItemResponse.model_validate(create_wish(db, child.id, child.parent_id, payload))


@child_router.patch("/wishes/{item_id}", response_model=ShopItemResponse)
def edit_wish(payload: WishCreate, item_id: UUID, child_device: tuple[Child, ChildDevice] = Depends(get_current_child), db: Session = Depends(get_db)):
    child, _ = child_device
    return ShopItemResponse.model_validate(update_child_wish(db, item_id, child.id, payload))
