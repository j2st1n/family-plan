from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.child import ChildBrief
from app.schemas.device import DeviceBindRequest, DeviceBindResponse
from app.services.devices import bind_child_device

router = APIRouter(prefix="/child-devices", tags=["child devices"])


@router.post("/bind", response_model=DeviceBindResponse)
def bind_device(payload: DeviceBindRequest, db: Session = Depends(get_db)) -> DeviceBindResponse:
    token, child = bind_child_device(db, payload.code, payload.display_name)
    return DeviceBindResponse(device_token=token, child=ChildBrief.model_validate(child))
