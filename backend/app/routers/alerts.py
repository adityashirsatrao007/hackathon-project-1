"""
Alert rule routes:
  POST   /projects/{project_id}/alert-rules/          — create rule
  GET    /projects/{project_id}/alert-rules/          — list rules
  PATCH  /projects/{project_id}/alert-rules/{rule_id} — update rule
  DELETE /projects/{project_id}/alert-rules/{rule_id} — delete rule
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from typing import Any

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.org import OrganizationMember
from app.models.project import Project
from app.models.event import AlertRule

router = APIRouter(tags=["Alert Rules"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class AlertRuleCreate(BaseModel):
    name: str
    condition: dict[str, Any]
    action: dict[str, Any]
    is_active: bool = True

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: dict) -> dict:
        valid_types = {"new_issue", "event_count", "issue_level"}
        ctype = v.get("type")
        if ctype not in valid_types:
            raise ValueError(f"condition.type must be one of {valid_types}")
        if ctype == "event_count":
            if "threshold" not in v:
                raise ValueError("event_count condition requires 'threshold'")
        return v

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: dict) -> dict:
        valid_types = {"email", "webhook"}
        atype = v.get("type")
        if atype not in valid_types:
            raise ValueError(f"action.type must be one of {valid_types}")
        if atype == "email" and not v.get("recipients"):
            raise ValueError("email action requires at least one recipient in 'recipients'")
        if atype == "webhook" and not v.get("url"):
            raise ValueError("webhook action requires a 'url'")
        return v


class AlertRuleUpdate(BaseModel):
    name: str | None = None
    condition: dict[str, Any] | None = None
    action: dict[str, Any] | None = None
    is_active: bool | None = None


class AlertRuleOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    condition: dict[str, Any]
    action: dict[str, Any]
    is_active: bool

    model_config = {"from_attributes": True}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _verify_project_access(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    m = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")
    return project


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/alert-rules/",
    response_model=AlertRuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an alert rule for a project",
)
async def create_alert_rule(
    project_id: uuid.UUID,
    req: AlertRuleCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(db, project_id, current_user.id)

    rule = AlertRule(
        project_id=project_id,
        name=req.name,
        condition=req.condition,
        action=req.action,
        is_active=req.is_active,
    )
    db.add(rule)
    await db.flush()
    return AlertRuleOut.model_validate(rule)


@router.get(
    "/projects/{project_id}/alert-rules/",
    response_model=list[AlertRuleOut],
    summary="List all alert rules for a project",
)
async def list_alert_rules(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(AlertRule).where(AlertRule.project_id == project_id)
    )
    return [AlertRuleOut.model_validate(r) for r in result.scalars().all()]


@router.patch(
    "/projects/{project_id}/alert-rules/{rule_id}",
    response_model=AlertRuleOut,
    summary="Update an alert rule",
)
async def update_alert_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    req: AlertRuleUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id, AlertRule.project_id == project_id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    if req.name is not None:
        rule.name = req.name
    if req.condition is not None:
        rule.condition = req.condition
    if req.action is not None:
        rule.action = req.action
    if req.is_active is not None:
        rule.is_active = req.is_active

    await db.flush()
    return AlertRuleOut.model_validate(rule)


@router.delete(
    "/projects/{project_id}/alert-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an alert rule",
)
async def delete_alert_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _verify_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id, AlertRule.project_id == project_id
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    await db.delete(rule)
    await db.flush()
