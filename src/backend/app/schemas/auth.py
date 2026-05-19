from uuid import UUID

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class ParentBrief(BaseModel):
    id: UUID
    nickname: str | None = None


class AuthResponse(BaseModel):
    token: str
    parent: ParentBrief
