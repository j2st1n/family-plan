from datetime import datetime

from pydantic import BaseModel


class AccessCodeResponse(BaseModel):
    code: str
    expires_at: datetime
