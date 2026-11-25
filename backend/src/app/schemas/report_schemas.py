from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SavedAssessment(BaseModel):
    user_id: UUID
    username: str
    report: str
    created_at: datetime
