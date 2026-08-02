from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


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
    status: str | None = None    # open | resolved | ignored


class IssueListResponse(BaseModel):
    total: int
    issues: list[IssueOut]
