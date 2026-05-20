from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.ratelimit import bind_limiter, get_client_ip
from app.db.session import get_db
from app.schemas.child import ChildBrief
from app.schemas.device import DeviceBindRequest, DeviceBindResponse
from app.services.devices import bind_child_device

router = APIRouter(prefix="/child-devices", tags=["child devices"])


async def _check_bind_rate(request: Request):
    ip = get_client_ip(request)
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    code = body.get("code") if isinstance(body, dict) else None
    if not bind_limiter.allow(code, ip=ip):
        raise api_error("rate_limited", "Too many bind attempts", status.HTTP_429_TOO_MANY_REQUESTS)


@router.post("/bind", response_model=DeviceBindResponse)
async def bind_device(payload: DeviceBindRequest, request: Request, db: Session = Depends(get_db)) -> DeviceBindResponse:
    await _check_bind_rate(request)
    token, child = bind_child_device(db, payload.code, payload.display_name)
    return DeviceBindResponse(device_token=token, child=ChildBrief.model_validate(child))
