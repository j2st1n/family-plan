from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_parent
from app.db.session import get_db
from app.models.parent import Parent
from app.schemas.access_code import AccessCodeResponse
from app.schemas.child import ChildCreate, ChildResponse, ChildUpdate
from app.services.access_codes import generate_child_access_code
from app.services.children import create_child, delete_child, get_child_for_parent, list_children, update_child
from app.services.event_hub import event_hub
from app.services.plans import get_child_dashboard

router = APIRouter(prefix="/children", tags=["children"])


@router.get("", response_model=list[ChildResponse])
def list_parent_children(
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> list[ChildResponse]:
    return [ChildResponse.model_validate(child) for child in list_children(db, parent.id)]


@router.get("/{child_id}/dashboard")
def child_dashboard(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    return get_child_dashboard(db, child_id, parent.id)


@router.post("", response_model=ChildResponse)
def create_parent_child(
    payload: ChildCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildResponse:
    child = create_child(db, parent.id, payload)
    event_hub.publish(parent.id, "children", "child_created", child.id)
    return ChildResponse.model_validate(child)


@router.get("/{child_id}", response_model=ChildResponse)
def get_parent_child(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildResponse:
    return ChildResponse.model_validate(get_child_for_parent(db, child_id, parent.id))


@router.post("/{child_id}/access-code", response_model=AccessCodeResponse)
def create_child_access_code(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> AccessCodeResponse:
    code, access_code = generate_child_access_code(db, child_id, parent.id)
    return AccessCodeResponse(code=code, expires_at=access_code.expires_at)


@router.patch("/{child_id}", response_model=ChildResponse)
def edit_child(
    child_id: UUID,
    payload: ChildUpdate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> ChildResponse:
    child = update_child(db, child_id, parent.id, payload)
    event_hub.publish(parent.id, "children", "child_updated", child.id)
    return ChildResponse.model_validate(child)


@router.delete("/{child_id}", status_code=204)
def remove_child(
    child_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    delete_child(db, child_id, parent.id)
    event_hub.publish(parent.id, "children", "child_deleted", child_id)
