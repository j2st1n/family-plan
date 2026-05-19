from uuid import UUID

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=6, max_length=128, pattern=r"^(?=.*[a-zA-Z])(?=.*\d).+$")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class ParentBrief(BaseModel):
    id: UUID
    nickname: str | None = None


class AuthResponse(BaseModel):
    token: str
    parent: ParentBrief
