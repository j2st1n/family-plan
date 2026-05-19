from uuid import UUID

from pydantic import BaseModel


class WechatLoginRequest(BaseModel):
    code: str


class ParentBrief(BaseModel):
    id: UUID
    nickname: str | None = None


class AuthResponse(BaseModel):
    token: str
    parent: ParentBrief
