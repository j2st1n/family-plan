from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

from jose import JWTError, jwt
import bcrypt

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


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("ascii"))
    except (ValueError, UnicodeError):
        return False


def hash_access_code(code: str) -> str:
    """Slow bcrypt hash for 6-digit child access codes."""
    return hash_password(code)


def verify_access_code(plain_code: str, hashed_code: str) -> bool:
    """Check candidate code against a stored bcrypt hash."""
    return verify_password(plain_code, hashed_code)
