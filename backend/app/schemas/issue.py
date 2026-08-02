from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class IssueOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    fingerprint: str
    level: str
    status: str
    first_seen: datetime
    last_seen: datetime
    event_count: int
    user_count: int


class IssueUpdateRequest(BaseModel):
    status: Optional[str] = None    # open | resolved | ignored


class IssueListResponse(BaseModel):
    total: int
    issues: list[IssueOut]
