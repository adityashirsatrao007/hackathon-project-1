from pydantic import BaseModel
from typing import Any, Optional
import uuid
from datetime import datetime


# ── Ingest (from SDK) ─────────────────────────────────────────────────────────

class ErrorInfo(BaseModel):
    type: str
    message: str
    stacktrace: Optional[str] = None


class ClientInfo(BaseModel):
    sdk: Optional[str] = "tracelify.python"


class IngestEventRequest(BaseModel):
    """Matches the event dict produced by user_sdk/client.py"""
    event_id: str
    project_id: str
    timestamp: str
    level: str = "error"
    release: Optional[str] = None
    fingerprint: Optional[str] = None
    client: Optional[ClientInfo] = None
    error: Optional[ErrorInfo] = None
    context: Optional[dict[str, Any]] = None
    tags: Optional[dict[str, Any]] = None
    user: Optional[dict[str, Any]] = None
    breadcrumbs: Optional[list[Any]] = None


class IngestResponse(BaseModel):
    event_id: str
    status: str = "queued"


# ── API Response ──────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    issue_id: Optional[uuid.UUID]
    level: str
    message: Optional[str]
    error_type: Optional[str]
    stacktrace: Optional[str]
    release: Optional[str]
    environment: str
    platform: str
    sdk_name: str
    context: dict
    tags: dict
    user_info: dict
    breadcrumbs: list
    fingerprint: Optional[str]
    received_at: datetime
