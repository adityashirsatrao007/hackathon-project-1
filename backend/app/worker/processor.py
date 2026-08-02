"""
Event Processor:
  Consumes a raw event JSON from Redis queue and:
  1. Parses + validates the payload
  2. Computes a fingerprint for issue grouping
  3. INSERTs the event row
  4. UPSERTs an Issue (create or increment counters)
  5. Links event.issue_id
  6. Evaluates alert rules
"""
import uuid
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.event import Event
from app.models.issue import Issue
from app.models.project import Project
from app.services.alert_service import evaluate_alerts
from loguru import logger


def _compute_fingerprint(payload: dict) -> str:
    """
    Create a stable fingerprint for grouping events into issues.
    Based on: error_type + first line of stacktrace.
    Falls back to error_type + message if no stacktrace.
    """
    if payload.get("fingerprint"):
        return payload["fingerprint"]

    error = payload.get("error") or {}
    error_type = error.get("type", "UnknownError")
    stacktrace = error.get("stacktrace", "") or ""

    # Take the last meaningful line of the stacktrace for grouping
    lines = [line.strip() for line in stacktrace.strip().splitlines() if line.strip()]
    key_line = lines[-1] if lines else (error.get("message", "") or "")

    raw = f"{error_type}:{key_line}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def process_event(raw_json: str) -> None:
    """
    Full pipeline: parse → store event → upsert issue → trigger alerts.
    Each call gets its own DB session (called from worker loop).
    """
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error(f"Invalid JSON in event queue: {exc}")
        return

    async with AsyncSessionLocal() as db:
        try:
            project_id, issue, is_new_issue = await _process(db, payload)
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.exception(f"Event processing failed: {exc}")
            return

    # Bug fix #3: Run alert evaluation AFTER commit so that an email/webhook
    # failure never triggers a rollback that drops the stored event.
    if issue is not None and project_id is not None:
        async with AsyncSessionLocal() as db:
            try:
                await evaluate_alerts(db, project_id, issue, is_new_issue)
            except Exception as exc:
                logger.error(f"Alert evaluation failed (event still saved): {exc!r}")


async def _process(db: AsyncSession, payload: dict) -> tuple:
    project_id_str = payload.get("project_id")
    event_id_str = payload.get("event_id")

    if not project_id_str or not event_id_str:
        logger.error("Event missing project_id or event_id — skipping")
        return None, None, False

    try:
        project_id = uuid.UUID(project_id_str)
        event_id = uuid.UUID(event_id_str)
    except ValueError as exc:
        logger.error(f"Invalid UUID in event payload: {exc}")
        return None, None, False

    # ── Verify project exists ──────────────────────────────────────────────────
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one_or_none()
    if not project:
        logger.warning(f"Project {project_id} not found, dropping event {event_id}")
        return None, None, False

    # ── Compute fingerprint ────────────────────────────────────────────────────
    fingerprint = _compute_fingerprint(payload)

    # ── Build event fields ─────────────────────────────────────────────────────
    error = payload.get("error") or {}
    error_type = error.get("type", "UnknownError")
    error_message = error.get("message", "")
    stacktrace = error.get("stacktrace", "")
    level = payload.get("level", "error")
    sdk_name = payload.get("sdk_name", "tracelify.python")

    # Parse timestamp
    raw_ts = payload.get("timestamp")
    try:
        received_at = datetime.fromisoformat(raw_ts) if raw_ts else datetime.now(timezone.utc)
    except Exception:
        received_at = datetime.now(timezone.utc)

    # ── Upsert Issue ───────────────────────────────────────────────────────────
    is_new_issue = False

    issue_result = await db.execute(
        select(Issue).where(
            Issue.project_id == project_id,
            Issue.fingerprint == fingerprint,
        )
    )
    issue = issue_result.scalar_one_or_none()

    if issue is None:
        # Brand new issue
        is_new_issue = True
        issue = Issue(
            project_id=project_id,
            title=f"{error_type}: {error_message}"[:500],
            fingerprint=fingerprint,
            level=level,
            status="open",
            first_seen=received_at,
            last_seen=received_at,
            event_count=1,
            user_count=1 if payload.get("user_info") else 0,
        )
        db.add(issue)
        await db.flush()
        logger.info(f"🐛 New issue created: '{issue.title}' [{issue.id}]")
    else:
        # Existing issue — re-open if resolved, update counters
        if issue.status == "resolved":
            issue.status = "open"
            logger.info(f"🔄 Issue re-opened: {issue.id}")

        issue.last_seen = received_at
        issue.event_count = (issue.event_count or 0) + 1
        if payload.get("user_info"):
            issue.user_count = (issue.user_count or 0) + 1

        await db.flush()
        logger.debug(f"📊 Issue {issue.id} event_count={issue.event_count}")

    # ── Insert Event ───────────────────────────────────────────────────────────
    event = Event(
        id=event_id,
        project_id=project_id,
        issue_id=issue.id,
        level=level,
        message=error_message,
        error_type=error_type,
        stacktrace=stacktrace,
        release=payload.get("release"),
        environment=payload.get("environment", "production"),
        platform="python",
        sdk_name=sdk_name,
        context=payload.get("context") or {},
        tags=payload.get("tags") or {},
        user_info=payload.get("user_info") or {},
        breadcrumbs=payload.get("breadcrumbs") or [],
        fingerprint=fingerprint,
        received_at=received_at,
    )
    db.add(event)
    await db.flush()

    logger.info(
        f"✅ Event {event_id} stored | issue={issue.id} | level={level} | "
        f"project={project_id}"
    )

    return project_id, issue, is_new_issue
