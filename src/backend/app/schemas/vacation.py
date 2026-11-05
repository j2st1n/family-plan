from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VacationCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_date_range(self) -> "VacationCreate":
        if self.start_date > self.end_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class VacationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    child_id: UUID
    start_date: date
    end_date: date
    reason: str | None = None
    created_at: datetime
    updated_at: datetime
