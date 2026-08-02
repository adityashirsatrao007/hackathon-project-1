import uuid
from datetime import datetime

from pydantic import BaseModel

# ── Request ───────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str
    slug: str
    platform: str = "python"


# ── Response ──────────────────────────────────────────────────────────────────

class ProjectOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    org_id: uuid.UUID
    platform: str
    created_at: datetime


class DsnKeyOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    public_key: str
    label: str
    is_active: bool
    created_at: datetime
    dsn: str        # full DSN string: http://<key>@host/api/<project_id>/events


class ProjectWithDsn(BaseModel):
    model_config = {"from_attributes": True}

    project: ProjectOut
    dsn_key: DsnKeyOut
