from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

# ── Request ───────────────────────────────────────────────────────────────────

class CreateOrgRequest(BaseModel):
    name: str
    slug: str


class AddMemberRequest(BaseModel):
    email: str
    role: str = "member"   # owner | admin | member


# ── Response ──────────────────────────────────────────────────────────────────

class OrgOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    created_at: datetime


class MemberOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    joined_at: datetime
    # Enriched from User table — may be None for legacy rows
    user_name: str | None = None
    user_email: str | None = None


class MyRoleOut(BaseModel):
    org_id: uuid.UUID
    role: str  # owner | admin | member | none
