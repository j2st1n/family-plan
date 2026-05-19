from datetime import UTC, datetime, timedelta
from random import SystemRandom
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_secret
from app.models.child_access_code import ChildAccessCode
from app.services.children import get_child_for_parent

_random = SystemRandom()


def generate_child_access_code(db: Session, child_id: UUID, parent_id: UUID) -> tuple[str, ChildAccessCode]:
    get_child_for_parent(db, child_id, parent_id)
    now = datetime.now(UTC)
    active_codes = db.scalars(
        select(ChildAccessCode).where(
            ChildAccessCode.child_id == child_id,
            ChildAccessCode.used_at.is_(None),
            ChildAccessCode.expires_at > now,
        )
    )
    for code in active_codes:
        code.used_at = now

    plain_code = f"{_random.randrange(0, 1_000_000):06d}"
    access_code = ChildAccessCode(
        child_id=child_id,
        code_hash=hash_secret(plain_code),
        expires_at=now + timedelta(minutes=settings.child_access_code_ttl_minutes),
    )
    db.add(access_code)
    db.commit()
    db.refresh(access_code)
    return plain_code, access_code
