from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.security import create_parent_token, hash_password, verify_password
from app.models.parent import Parent
from app.schemas.auth import RegisterRequest


def register_parent(db: Session, data: RegisterRequest) -> tuple[Parent, str]:
    existing = db.scalar(select(Parent).where(Parent.username == data.username))
    if existing:
        raise api_error("conflict", "Username already exists", 409)
    parent = Parent(username=data.username, password_hash=hash_password(data.password), nickname=data.username)
    db.add(parent)
    db.commit()
    db.refresh(parent)
    return parent, create_parent_token(str(parent.id))


def login_parent(db: Session, username: str, password: str) -> tuple[Parent, str]:
    parent = db.scalar(select(Parent).where(Parent.username == username))
    if parent is None or not parent.password_hash or not verify_password(password, parent.password_hash):
        raise api_error("unauthorized", "Invalid username or password", 401)
    return parent, create_parent_token(str(parent.id))
