from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

# ── Ingest (from SDK) ─────────────────────────────────────────────────────────

class ErrorInfo(BaseModel):
    type: str
    message: str
    stacktrace: str | None = None


class ClientInfo(BaseModel):
    sdk: str | None = "tracelify.python"


class IngestEventRequest(BaseModel):
    """Matches the event dict produced by user_sdk/client.py"""
    event_id: str
    project_id: str
    timestamp: str
    level: str = "error"
    release: str | None = None
    fingerprint: str | None = None
    client: ClientInfo | None = None
    error: ErrorInfo | None = None
    context: dict[str, Any] | None = None
    tags: dict[str, Any] | None = None
    user: dict[str, Any] | None = None
    breadcrumbs: list[Any] | None = None


class IngestResponse(BaseModel):
    event_id: str
    status: str = "queued"


# ── API Response ──────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    issue_id: uuid.UUID | None
    level: str
    message: str | None
    error_type: str | None
    stacktrace: str | None
    release: str | None
    environment: str
    platform: str
    sdk_name: str
    context: dict
    tags: dict
    user_info: dict
    breadcrumbs: list
    fingerprint: str | None
    received_at: datetime
