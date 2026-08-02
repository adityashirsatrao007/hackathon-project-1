"""
Alert service:
 - Evaluate alert rules for a project after a new event is processed
 - Currently supports: event_count threshold and new_issue triggers
 - Actions: email (via SMTP) and webhook (HTTP POST)
"""
import httpx
import ipaddress
import uuid
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.event import AlertRule, Event
from app.models.issue import Issue
from app.core.config import settings
from app.core.redis import get_redis_pool
from loguru import logger


async def evaluate_alerts(
    db: AsyncSession,
    project_id: uuid.UUID,
    issue: Issue,
    is_new_issue: bool,
) -> None:
    """Check all active alert rules for a project and fire if conditions met."""
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.project_id == project_id,
            AlertRule.is_active == True,  # noqa: E712
        )
    )
    rules = result.scalars().all()

    for rule in rules:
        try:
            should_fire = await _check_condition(db, rule, issue, is_new_issue, project_id)
            if should_fire:
                # ── Cooldown check: skip if rule already fired recently ──────
                if await _is_on_cooldown(rule):
                    logger.debug(
                        f"⏱️  Rule '{rule.name}' is on cooldown — skipping"
                    )
                    continue
                await _set_cooldown(rule)
                await _fire_action(rule, issue)
        except Exception as exc:
            logger.error(f"Alert rule {rule.id} evaluation failed: {exc}")


async def _check_condition(
    db: AsyncSession,
    rule: AlertRule,
    issue: Issue,
    is_new_issue: bool,
    project_id: uuid.UUID,
) -> bool:
    """Return True if the rule condition is satisfied."""
    condition = rule.condition
    ctype = condition.get("type", "")

    if ctype == "new_issue":
        # Fire when a brand new issue is created
        return is_new_issue

    if ctype == "event_count":
        # Fire when event count in the last N minutes exceeds threshold
        threshold = int(condition.get("threshold", 10))
        window_minutes = int(condition.get("window_minutes", 60))
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

        count_result = await db.execute(
            select(func.count(Event.id)).where(
                Event.project_id == project_id,
                Event.received_at >= since,
            )
        )
        count = count_result.scalar_one()
        return count >= threshold

    if ctype == "issue_level":
        # Fire when an issue of a specific level is seen
        target_level = condition.get("level", "error")
        return issue.level == target_level

    logger.warning(f"Unknown alert condition type: {ctype}")
    return False


# ── Cooldown helpers ───────────────────────────────────────────────────────────
# Each rule is rate-limited to fire at most once per COOLDOWN_SECONDS.
# Redis key: "alert:cooldown:<rule_id>"

COOLDOWN_SECONDS = 15 * 60  # 15 minutes


async def _is_on_cooldown(rule: AlertRule) -> bool:
    """Return True if this rule has fired recently (cooldown key exists in Redis)."""
    try:
        redis = await get_redis_pool()
        key = f"alert:cooldown:{rule.id}"
        return await redis.exists(key) == 1
    except Exception as exc:
        # If Redis is unreachable, let the alert fire (fail-open)
        logger.warning(f"Cooldown check failed for rule {rule.id}: {exc!r} — allowing fire")
        return False


async def _set_cooldown(rule: AlertRule) -> None:
    """Mark this rule as recently fired so it won't fire again until cooldown expires."""
    try:
        redis = await get_redis_pool()
        key = f"alert:cooldown:{rule.id}"
        await redis.set(key, "1", ex=COOLDOWN_SECONDS)
    except Exception as exc:
        logger.warning(f"Failed to set cooldown for rule {rule.id}: {exc!r}")


async def _fire_action(rule: AlertRule, issue: Issue) -> None:
    """Execute the alert action (email or webhook)."""
    action = rule.action
    atype = action.get("type", "")

    if atype == "email":
        await _send_email_alert(action, rule, issue)
    elif atype == "webhook":
        await _send_webhook(action, rule, issue)
    else:
        logger.warning(f"Unknown alert action type: {atype}")


async def _send_email_alert(action: dict, rule: AlertRule, issue: Issue) -> None:
    """Send an email alert using aiosmtplib."""
    # Bug fix #1: Guard against unconfigured SMTP credentials.
    # Without this, aiosmtplib.send() silently fails with a Gmail auth error.
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "Email alert skipped: SMTP_USER or SMTP_PASSWORD is not configured in .env"
        )
        return

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        recipients = action.get("recipients", [])
        if not recipients:
            logger.warning(f"Email alert rule '{rule.name}' has no recipients configured.")
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🚨 Tracelify Alert: {rule.name}"
        # Bug fix #2: Gmail REJECTS emails where From != the authenticated account.
        # Use SMTP_USER (surajyou45@gmail.com) as From, not ALERT_FROM_EMAIL.
        msg["From"] = settings.SMTP_USER
        msg["To"] = ", ".join(recipients)

        body = f"""
        <html><body>
        <h2>🚨 Tracelify Alert Triggered</h2>
        <p><strong>Rule:</strong> {rule.name}</p>
        <p><strong>Issue:</strong> {issue.title}</p>
        <p><strong>Level:</strong> {issue.level}</p>
        <p><strong>Status:</strong> {issue.status}</p>
        <p><strong>Event Count:</strong> {issue.event_count}</p>
        <p><strong>Last Seen:</strong> {issue.last_seen}</p>
        </body></html>
        """
        msg.attach(MIMEText(body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"📧 Alert email sent to {recipients} for rule '{rule.name}'")

    except Exception as exc:
        logger.error(f"Failed to send email alert: {exc!r}")


_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _validate_webhook_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("https",):
        raise ValueError(f"Webhook URL must use HTTPS (got: {parsed.scheme})")

    host = parsed.hostname or ""
    # Block raw IPs that are private
    try:
        addr = ipaddress.ip_address(host)
        for block in _PRIVATE_NETWORKS:
            if addr in block:
                raise ValueError(f"Webhook URL targets a private/reserved IP range: {host}")
    except ValueError as e:
        if "private/reserved" in str(e):
            raise
        # Not an IP address — hostname, continue
        pass

    # Block hostnames likely to resolve to localhost
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "[::1]", "host.docker.internal"}
    if host.split(":")[0].strip("[]") in blocked_hosts:
        raise ValueError(f"Webhook URL targets a blocked hostname: {host}")


async def _send_webhook(action: dict, rule: AlertRule, issue: Issue) -> None:
    """POST a JSON payload to a webhook URL."""
    url = action.get("url")
    if not url:
        return

    try:
        _validate_webhook_url(url)
    except ValueError as exc:
        logger.warning(f"Webhook blocked for rule '{rule.name}': {exc}")
        return

    payload = {
        "alert_rule": rule.name,
        "issue_id": str(issue.id),
        "issue_title": issue.title,
        "level": issue.level,
        "status": issue.status,
        "event_count": issue.event_count,
        "last_seen": issue.last_seen.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        logger.info(f"🔔 Webhook sent to {url} for rule '{rule.name}'")
    except Exception as exc:
        logger.error(f"Webhook failed for rule '{rule.name}': {exc}")
