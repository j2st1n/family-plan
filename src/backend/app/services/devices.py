from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.security import generate_device_token, hash_secret, verify_access_code
from app.models.child import Child
from app.models.child_access_code import ChildAccessCode
from app.models.child_device import ChildDevice


def bind_child_device(db: Session, code: str, display_name: str | None) -> tuple[str, Child]:
    now = datetime.now(UTC)
    candidates = db.scalars(
        select(ChildAccessCode).where(
            ChildAccessCode.used_at.is_(None),
            ChildAccessCode.expires_at > now,
        )
    ).all()
    access_code = next((c for c in candidates if verify_access_code(code, c.code_hash)), None)
    if access_code is None:
        raise api_error("invalid_code", "Access code is invalid or expired", 400)
    child = db.get(Child, access_code.child_id)
    if child is None:
        raise api_error("invalid_code", "Access code is invalid or expired", 400)

    token = generate_device_token()
    access_code.used_at = now
    db.add(ChildDevice(child_id=child.id, device_token_hash=hash_secret(token), display_name=display_name))
    db.commit()
    db.refresh(child)
    return token, child
