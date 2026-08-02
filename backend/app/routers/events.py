"""
Event Ingest Route — the SDK posts events here.

DSN format: http://<public_key>@host/api/<project_id>/events

The SDK sends:
  - POST /api/{project_id}/events
  - Authorization: Bearer <public_key>   (or X-Tracelify-Key header)
  - Body: JSON event payload
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.schemas.event import IngestEventRequest, IngestResponse
from app.services import ingest_service

router = APIRouter(prefix="/api", tags=["Event Ingest"])


@router.post(
    "/{project_id}/events",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest an event from the SDK",
)
async def ingest_event(
    project_id: str,
    event: IngestEventRequest,
    db: AsyncSession = Depends(get_db),
    # Accept public_key via Authorization header OR X-Tracelify-Key header
    authorization: Optional[str] = Header(default=None),
    x_tracelify_key: Optional[str] = Header(default=None, alias="X-Tracelify-Key"),
):
    """
    Called by the Tracelify SDK.
    - Validates the DSN (public_key + project_id)
    - Pushes event to Redis queue
    - Returns 202 Accepted immediately (async processing)
    """
    # Extract public_key from Authorization: Bearer <key> or X-Tracelify-Key
    public_key: Optional[str] = None

    if x_tracelify_key:
        public_key = x_tracelify_key
    elif authorization and authorization.startswith("Bearer "):
        public_key = authorization.removeprefix("Bearer ").strip()
    elif authorization and authorization.startswith("Basic "):
        import base64
        try:
            decoded = base64.b64decode(authorization.removeprefix("Basic ").strip()).decode()
            public_key = decoded.split(":")[0]  # username:password format
        except Exception:
            pass

    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing DSN public key. Send via Authorization: Bearer <key> or X-Tracelify-Key header",
        )

    # Validate DSN → get project
    project = await ingest_service.validate_dsn(db, public_key, project_id)

    # Push to Redis queue (with dedup)
    event_id = await ingest_service.enqueue_event(project, event, public_key, db)

    return IngestResponse(event_id=event_id, status="queued")
