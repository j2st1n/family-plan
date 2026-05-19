from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=6, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one digit")
        return v


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class ParentBrief(BaseModel):
    id: UUID
    nickname: str | None = None


class AuthResponse(BaseModel):
    token: str
    parent: ParentBrief
