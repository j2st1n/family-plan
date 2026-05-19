from pydantic import BaseModel, Field

from app.schemas.child import ChildBrief


class DeviceBindRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    display_name: str | None = Field(default=None, max_length=80)


class DeviceBindResponse(BaseModel):
    device_token: str
    child: ChildBrief
