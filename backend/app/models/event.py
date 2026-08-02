from __future__ import annotations
import uuid
from sqlalchemy import String, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import func
from sqlalchemy.types import DateTime
from app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True          # event_id from SDK
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    issue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("issues.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    level: Mapped[str] = mapped_column(String, default="error")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_type: Mapped[str | None] = mapped_column(String, nullable=True)   # exception class
    stacktrace: Mapped[str | None] = mapped_column(Text, nullable=True)
    release: Mapped[str | None] = mapped_column(String, nullable=True)
    environment: Mapped[str] = mapped_column(String, default="production")
    platform: Mapped[str] = mapped_column(String, default="python")
    sdk_name: Mapped[str] = mapped_column(String, default="tracelify.python")
    context: Mapped[dict] = mapped_column(JSONB, default=dict)              # OS, runtime
    tags: Mapped[dict] = mapped_column(JSONB, default=dict)                 # set_tag()
    user_info: Mapped[dict] = mapped_column(JSONB, default=dict)            # set_user()
    breadcrumbs: Mapped[list] = mapped_column(JSONB, default=list)          # breadcrumbs
    fingerprint: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    received_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    project: Mapped["Project"] = relationship(    # noqa: F821
        "Project", back_populates="events", lazy="select"
    )
    issue: Mapped["Issue | None"] = relationship(  # noqa: F821
        "Issue", back_populates="events", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Event {self.id} level={self.level}>"


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    condition: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
        # e.g. {"type": "event_count", "threshold": 10, "window_minutes": 60}
    )
    action: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
        # e.g. {"type": "email", "recipients": ["admin@co.com"]}
        # or  {"type": "webhook", "url": "https://..."}
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship
    project: Mapped["Project"] = relationship(    # noqa: F821
        "Project", back_populates="alert_rules", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<AlertRule {self.name}>"
