from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.ratelimit import auth_limiter, get_client_ip
from app.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, ParentBrief, RegisterRequest
from app.services.auth import login_parent, register_parent

router = APIRouter(prefix="/auth", tags=["auth"])


async def _check_auth_rate(request: Request):
    ip = get_client_ip(request)
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    username = body.get("username") if isinstance(body, dict) else None
    if not auth_limiter.allow(username, ip=ip):
        raise api_error("rate_limited", "Too many requests", status.HTTP_429_TOO_MANY_REQUESTS)


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    await _check_auth_rate(request)
    parent, token = register_parent(db, payload)
    return AuthResponse(token=token, parent=ParentBrief.model_validate(parent, from_attributes=True))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    await _check_auth_rate(request)
    parent, token = login_parent(db, payload.username, payload.password)
    return AuthResponse(token=token, parent=ParentBrief.model_validate(parent, from_attributes=True))
