"""
Organization routes:
  POST /orgs/                        — create org
  GET  /orgs/                        — list my orgs
  GET  /orgs/{org_id}                — get org detail
  POST /orgs/{org_id}/members        — add member
  GET  /orgs/{org_id}/members        — list members (with user name + email)
  GET  /orgs/{org_id}/my-role        — get current user's role in this org
"""
import uuid
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.org import Organization, OrganizationMember
from app.models.user import User
from app.schemas.org import CreateOrgRequest, OrgOut, MemberOut, AddMemberRequest, MyRoleOut

router = APIRouter(prefix="/orgs", tags=["Organizations"])


def _slugify(name: str) -> str:
    """Basic slug generator."""
    return re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-")


@router.post(
    "/",
    response_model=OrgOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new organization",
)
async def create_org(
    req: CreateOrgRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Check slug uniqueness
    result = await db.execute(
        select(Organization).where(Organization.slug == req.slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug '{req.slug}' is already taken",
        )

    org = Organization(name=req.name, slug=req.slug, owner_id=current_user.id)
    db.add(org)
    await db.flush()

    # Auto-add creator as owner member
    membership = OrganizationMember(
        org_id=org.id, user_id=current_user.id, role="owner"
    )
    db.add(membership)
    await db.flush()

    return OrgOut.model_validate(org)


@router.get(
    "/",
    response_model=list[OrgOut],
    summary="List organizations I belong to",
)
async def list_my_orgs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == current_user.id)
    )
    orgs = result.scalars().all()
    return [OrgOut.model_validate(o) for o in orgs]


@router.get(
    "/{org_id}",
    response_model=OrgOut,
    summary="Get org by ID",
)
async def get_org(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check membership
    m = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    return OrgOut.model_validate(org)


@router.post(
    "/{org_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member to an org",
)
async def add_member(
    org_id: uuid.UUID,
    req: AddMemberRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Only owner/admin can add
    m_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["owner", "admin"]),
        )
    )
    if not m_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Find user by email
    u_result = await db.execute(select(User).where(User.email == req.email))
    target = u_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User with that email not found")

    # Check not already a member
    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == target.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    member = OrganizationMember(org_id=org_id, user_id=target.id, role=req.role)
    db.add(member)
    await db.flush()
    return MemberOut.model_validate(member)


@router.get(
    "/{org_id}/members",
    response_model=list[MemberOut],
    summary="List org members (with user name + email)",
)
async def list_members(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Verify membership
    m_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    if not m_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    # JOIN with User to get name + email
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.org_id == org_id)
    )
    rows = result.all()

    out = []
    for membership, user in rows:
        out.append(
            MemberOut(
                id=membership.id,
                org_id=membership.org_id,
                user_id=membership.user_id,
                role=membership.role,
                joined_at=membership.joined_at,
                user_name=user.name,
                user_email=user.email,
            )
        )
    return out


@router.get(
    "/{org_id}/my-role",
    response_model=MyRoleOut,
    summary="Get current user's role in this org",
)
async def get_my_role(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return MyRoleOut(org_id=org_id, role=membership.role)


# ── Rename org ─────────────────────────────────────────────────────────────────

@router.patch(
    "/{org_id}",
    response_model=OrgOut,
    summary="Rename an organization",
)
async def rename_org(
    org_id: uuid.UUID,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Only owner can rename
    if org.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can rename this organization")

    new_name = body.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    org.name = new_name
    await db.flush()
    return OrgOut.model_validate(org)


# ── Delete org ─────────────────────────────────────────────────────────────────

@router.delete(
    "/{org_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an organization (owner only)",
)
async def delete_org(
    org_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this organization")

    await db.delete(org)
    await db.flush()

