from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, ParentBrief, RegisterRequest
from app.services.auth import login_parent, register_parent

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    parent, token = register_parent(db, payload)
    return AuthResponse(token=token, parent=ParentBrief.model_validate(parent, from_attributes=True))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    parent, token = login_parent(db, payload.username, payload.password)
    return AuthResponse(token=token, parent=ParentBrief.model_validate(parent, from_attributes=True))
