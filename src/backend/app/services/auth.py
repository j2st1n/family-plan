from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_parent_token
from app.models.parent import Parent

DEV_OPENID = "dev-parent"


def login_dev_parent(db: Session) -> tuple[Parent, str]:
    parent = db.scalar(select(Parent).where(Parent.wechat_openid == DEV_OPENID))
    if parent is None:
        parent = Parent(wechat_openid=DEV_OPENID, nickname="Dev Parent")
        db.add(parent)
        db.commit()
        db.refresh(parent)
    return parent, create_parent_token(str(parent.id))
