from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, Header, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.security import decode_parent_token, hash_secret
from app.db.session import get_db
from app.models.child import Child
from app.models.child_device import ChildDevice
from app.models.parent import Parent


def get_current_parent(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Parent:
    if not authorization or not authorization.startswith("Bearer "):
        raise api_error("unauthorized", "Missing bearer token", status.HTTP_401_UNAUTHORIZED)
    parent_id = decode_parent_token(authorization.removeprefix("Bearer ").strip())
    if parent_id is None:
        raise api_error("unauthorized", "Invalid bearer token", status.HTTP_401_UNAUTHORIZED)
    try:
        parent_uuid = UUID(parent_id)
    except ValueError as exc:
        raise api_error("unauthorized", "Invalid bearer token", status.HTTP_401_UNAUTHORIZED) from exc
    parent = db.get(Parent, parent_uuid)
    if parent is None:
        raise api_error("unauthorized", "Parent not found", status.HTTP_401_UNAUTHORIZED)
    return parent


def get_current_child(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> tuple[Child, ChildDevice]:
    if not authorization or not authorization.startswith("Bearer "):
        raise api_error("unauthorized", "Missing bearer token", status.HTTP_401_UNAUTHORIZED)
    raw_token = authorization.removeprefix("Bearer ").strip()
    token_hash = hash_secret(raw_token)
    device = db.scalar(
        select(ChildDevice).where(
            ChildDevice.device_token_hash == token_hash,
            ChildDevice.revoked_at.is_(None),
        )
    )
    if device is None:
        raise api_error("unauthorized", "Invalid device token", status.HTTP_401_UNAUTHORIZED)
    if device.created_at and datetime.now(UTC) - device.created_at.replace(tzinfo=UTC) > timedelta(days=30):
        device.revoked_at = datetime.now(UTC)
        db.commit()
        raise api_error("unauthorized", "Device token expired, please re-bind", status.HTTP_401_UNAUTHORIZED)
    if device.last_seen_at is None or datetime.now(UTC) - device.last_seen_at.replace(tzinfo=UTC) > timedelta(hours=1):
        device.last_seen_at = datetime.now(UTC)
        db.commit()
    child = db.get(Child, device.child_id)
    if child is None:
        raise api_error("unauthorized", "Child not found", status.HTTP_401_UNAUTHORIZED)
    return child, device
