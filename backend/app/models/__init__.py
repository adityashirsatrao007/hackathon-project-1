"""
Model registry — import everything here so SQLAlchemy sees all metadata
before create_all() or Alembic autogenerate runs.
"""
from app.models.event import AlertRule, Event
from app.models.issue import Issue
from app.models.org import Organization, OrganizationMember
from app.models.project import DsnKey, Project
from app.models.user import User

__all__ = [
    "AlertRule",
    "DsnKey",
    "Event",
    "Issue",
    "Organization",
    "OrganizationMember",
    "Project",
    "User",
]
