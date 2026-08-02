"""
Model registry — import everything here so SQLAlchemy sees all metadata
before create_all() or Alembic autogenerate runs.
"""
from app.models.user import User
from app.models.org import Organization, OrganizationMember
from app.models.project import Project, DsnKey
from app.models.issue import Issue
from app.models.event import Event, AlertRule

__all__ = [
    "User",
    "Organization",
    "OrganizationMember",
    "Project",
    "DsnKey",
    "Issue",
    "Event",
    "AlertRule",
]
