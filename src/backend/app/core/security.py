from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

ALGORITHM = "HS256"


def hash_secret(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def generate_device_token() -> str:
    return uuid4().hex + uuid4().hex


def create_parent_token(parent_id: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(days=settings.access_token_expire_days)
    return jwt.encode({"sub": parent_id, "exp": expires_at}, settings.jwt_secret, algorithm=ALGORITHM)


def decode_parent_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        return None
    return subject


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_access_code(code: str) -> str:
    """Slow bcrypt hash for 6-digit child access codes."""
    return pwd_context.hash(code)


def verify_access_code(plain_code: str, hashed_code: str) -> bool:
    """Check candidate code against a stored bcrypt hash."""
    return pwd_context.verify(plain_code, hashed_code)
