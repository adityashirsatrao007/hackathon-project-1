from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime

from app.core.database import Base


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("project_id", "fingerprint", name="uq_issue_project_fingerprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)        # "ValueError: division by zero"
    fingerprint: Mapped[str] = mapped_column(String, nullable=False, index=True)
    level: Mapped[str] = mapped_column(String, default="error")     # error | warning | info
    status: Mapped[str] = mapped_column(String, default="open")     # open | resolved | ignored
    first_seen: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    event_count: Mapped[int] = mapped_column(Integer, default=1)
    user_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    project: Mapped[Project] = relationship(       # noqa: F821
        "Project", back_populates="issues", lazy="select"
    )
    events: Mapped[list[Event]] = relationship(  # noqa: F821
        "Event", back_populates="issue", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Issue {self.title[:40]} [{self.status}]>"
