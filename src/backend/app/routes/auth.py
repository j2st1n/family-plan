from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import AuthResponse, ParentBrief, WechatLoginRequest
from app.services.auth import login_dev_parent

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/wechat", response_model=AuthResponse)
def login(_: WechatLoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    parent, token = login_dev_parent(db)
    return AuthResponse(token=token, parent=ParentBrief.model_validate(parent, from_attributes=True))
