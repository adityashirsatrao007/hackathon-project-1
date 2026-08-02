"""
Issue routes:
  GET   /projects/{project_id}/issues/           — list issues (with filters)
  GET   /projects/{project_id}/issues/{issue_id} — issue detail
  PATCH /projects/{project_id}/issues/{issue_id} — update status
  GET   /projects/{project_id}/issues/{issue_id}/events — events in this issue
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.org import OrganizationMember
from app.models.project import Project
from app.models.issue import Issue
from app.models.event import Event
from app.schemas.issue import IssueOut, IssueUpdateRequest, IssueListResponse
from app.schemas.event import EventOut

router = APIRouter(tags=["Issues"])


async def _get_project_and_verify(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    m_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if not m_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    return project


@router.get(
    "/projects/{project_id}/issues/",
    response_model=IssueListResponse,
    summary="List issues for a project",
)
async def list_issues(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status: str = Query(default="open", description="Filter by status: open | resolved | ignored | all"),
    level: str | None = Query(default=None, description="Filter by level: error | warning | info"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    await _get_project_and_verify(db, project_id, current_user.id)

    query = select(Issue).where(Issue.project_id == project_id)

    if status != "all":
        query = query.where(Issue.status == status)
    if level:
        query = query.where(Issue.level == level)

    # Total count
    count_result = await db.execute(
        select(func.count(Issue.id)).where(
            Issue.project_id == project_id,
            *([] if status == "all" else [Issue.status == status]),
        )
    )
    total = count_result.scalar_one()

    # Paginated, ordered by last_seen desc
    query = query.order_by(Issue.last_seen.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    issues = result.scalars().all()

    return IssueListResponse(
        total=total,
        issues=[IssueOut.model_validate(i) for i in issues],
    )


@router.get(
    "/projects/{project_id}/issues/{issue_id}",
    response_model=IssueOut,
    summary="Get issue detail",
)
async def get_issue(
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_and_verify(db, project_id, current_user.id)

    result = await db.execute(
        select(Issue).where(Issue.id == issue_id, Issue.project_id == project_id)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    return IssueOut.model_validate(issue)


@router.patch(
    "/projects/{project_id}/issues/{issue_id}",
    response_model=IssueOut,
    summary="Update issue status (open / resolved / ignored)",
)
async def update_issue(
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
    req: IssueUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_and_verify(db, project_id, current_user.id)

    result = await db.execute(
        select(Issue).where(Issue.id == issue_id, Issue.project_id == project_id)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    VALID_STATUSES = {"open", "resolved", "ignored"}
    if req.status and req.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {VALID_STATUSES}")

    if req.status:
        issue.status = req.status

    await db.flush()
    await db.refresh(issue)   # reload from DB so Pydantic doesn't hit expired attrs
    return IssueOut.model_validate(issue)


@router.get(
    "/projects/{project_id}/issues/{issue_id}/events",
    response_model=list[EventOut],
    summary="Get all events for an issue",
)
async def get_issue_events(
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    await _get_project_and_verify(db, project_id, current_user.id)

    result = await db.execute(
        select(Event)
        .where(Event.issue_id == issue_id, Event.project_id == project_id)
        .order_by(Event.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return [EventOut.model_validate(e) for e in events]
