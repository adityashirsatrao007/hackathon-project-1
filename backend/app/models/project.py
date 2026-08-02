import uuid
import secrets
from sqlalchemy import String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import func
from sqlalchemy.types import DateTime
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("org_id", "slug", name="uq_project_org_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    platform: Mapped[str] = mapped_column(String, default="python")
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    org: Mapped["Organization"] = relationship(  # noqa: F821
        "Organization", back_populates="projects", lazy="select"
    )
    dsn_keys: Mapped[list["DsnKey"]] = relationship(
        "DsnKey", back_populates="project", lazy="select"
    )
    events: Mapped[list["Event"]] = relationship(  # noqa: F821
        "Event", back_populates="project", lazy="select"
    )
    issues: Mapped[list["Issue"]] = relationship(  # noqa: F821
        "Issue", back_populates="project", lazy="select"
    )
    alert_rules: Mapped[list["AlertRule"]] = relationship(  # noqa: F821
        "AlertRule", back_populates="project", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Project {self.slug}>"


class DsnKey(Base):
    __tablename__ = "dsn_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    public_key: Mapped[str] = mapped_column(
        String,
        unique=True,
        nullable=False,
        default=lambda: secrets.token_hex(16),  # 32-char hex
    )
    label: Mapped[str] = mapped_column(String, default="Default")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    project: Mapped["Project"] = relationship(
        "Project", back_populates="dsn_keys", lazy="select"
    )

    @property
    def dsn(self) -> str:
        """Return the full DSN string for this key."""
        from app.core.config import settings
        return (
            f"http://{self.public_key}"
            f"@{settings.BACKEND_URL.replace('http://', '').replace('https://', '')}"
            f"/api/{self.project_id}/events"
        )

    def __repr__(self) -> str:
        return f"<DsnKey {self.public_key[:8]}...>"
