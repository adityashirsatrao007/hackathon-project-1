"""
Project routes:
  POST /orgs/{org_id}/projects/            — create project + auto-generate DSN
  GET  /orgs/{org_id}/projects/            — list projects in org
  GET  /projects/{project_id}              — get project detail
  GET  /projects/{project_id}/dsn          — list DSN keys
  POST /projects/{project_id}/dsn          — rotate / add new DSN key
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.org import Organization, OrganizationMember
from app.models.project import Project, DsnKey
from app.schemas.project import (
    CreateProjectRequest,
    ProjectOut,
    DsnKeyOut,
    ProjectWithDsn,
)

router = APIRouter(tags=["Projects"])


async def _assert_org_member(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this organization")


# ── Create project ─────────────────────────────────────────────────────────────

@router.post(
    "/orgs/{org_id}/projects/",
    response_model=ProjectWithDsn,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project and generate its DSN",
)
async def create_project(
    org_id: uuid.UUID,
    req: CreateProjectRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _assert_org_member(db, org_id, current_user.id)

    # Verify org exists
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    if not org_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    project = Project(
        name=req.name,
        slug=req.slug,
        org_id=org_id,
        platform=req.platform,
    )
    db.add(project)
    await db.flush()

    # Auto-generate a DSN key
    dsn_key = DsnKey(project_id=project.id, label="Default")
    db.add(dsn_key)
    await db.flush()

    return ProjectWithDsn(
        project=ProjectOut.model_validate(project),
        dsn_key=DsnKeyOut(
            id=dsn_key.id,
            project_id=dsn_key.project_id,
            public_key=dsn_key.public_key,
            label=dsn_key.label,
            is_active=dsn_key.is_active,
            created_at=dsn_key.created_at,
            dsn=dsn_key.dsn,
        ),
    )


# ── List projects in org ───────────────────────────────────────────────────────

@router.get(
    "/orgs/{org_id}/projects/",
    response_model=list[ProjectOut],
    summary="List all projects in an organization",
)
async def list_projects(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _assert_org_member(db, org_id, current_user.id)

    result = await db.execute(
        select(Project).where(Project.org_id == org_id)
    )
    projects = result.scalars().all()
    return [ProjectOut.model_validate(p) for p in projects]


# ── Get project detail ─────────────────────────────────────────────────────────

@router.get(
    "/projects/{project_id}",
    response_model=ProjectOut,
    summary="Get project detail",
)
async def get_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _assert_org_member(db, project.org_id, current_user.id)
    return ProjectOut.model_validate(project)


# ── DSN key management ─────────────────────────────────────────────────────────

@router.get(
    "/projects/{project_id}/dsn",
    response_model=list[DsnKeyOut],
    summary="List DSN keys for a project",
)
async def list_dsn_keys(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _assert_org_member(db, project.org_id, current_user.id)

    keys_result = await db.execute(
        select(DsnKey).where(DsnKey.project_id == project_id)
    )
    keys = keys_result.scalars().all()

    return [
        DsnKeyOut(
            id=k.id,
            project_id=k.project_id,
            public_key=k.public_key,
            label=k.label,
            is_active=k.is_active,
            created_at=k.created_at,
            dsn=k.dsn,
        )
        for k in keys
    ]


@router.post(
    "/projects/{project_id}/dsn",
    response_model=DsnKeyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new DSN key for a project",
)
async def create_dsn_key(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    label: str = "New Key",
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _assert_org_member(db, project.org_id, current_user.id)

    key = DsnKey(project_id=project_id, label=label)
    db.add(key)
    await db.flush()

    return DsnKeyOut(
        id=key.id,
        project_id=key.project_id,
        public_key=key.public_key,
        label=key.label,
        is_active=key.is_active,
        created_at=key.created_at,
        dsn=key.dsn,
    )


# ── Rename project ─────────────────────────────────────────────────────────────

@router.patch(
    "/projects/{project_id}",
    response_model=ProjectOut,
    summary="Rename a project",
)
async def rename_project(
    project_id: uuid.UUID,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _assert_org_member(db, project.org_id, current_user.id)

    new_name = body.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    project.name = new_name
    await db.flush()
    return ProjectOut.model_validate(project)


# ── Delete project ─────────────────────────────────────────────────────────────

@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project and all its data",
)
async def delete_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _assert_org_member(db, project.org_id, current_user.id)
    await db.delete(project)
    await db.flush()

