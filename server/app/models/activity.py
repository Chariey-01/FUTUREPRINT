"""User activity: anonymous sessions, recorded choices, reports and AI usage."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import SESSION_STATUSES, TimestampMixin, UUIDPrimaryKeyMixin, sql_in
from app.models.content import ContentVersion, Occupation, Scenario, ScenarioChoice


class AnonymousSession(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A server-side simulation session identified by a hashed bearer token.

    The raw token is returned to the client exactly once and never stored.
    ``current_scenario_id`` is authoritative: clients only ever send a
    ``choice_id``, which is validated against this column.
    """

    __tablename__ = "anonymous_sessions"
    __table_args__ = (
        CheckConstraint(sql_in("status", SESSION_STATUSES), name="status"),
        CheckConstraint(
            "(status = 'active' AND current_scenario_id IS NOT NULL AND completed_at IS NULL)"
            " OR (status = 'completed' AND current_scenario_id IS NULL AND completed_at IS NOT NULL)",
            name="status_consistency",
        ),
        CheckConstraint("step_count >= 0", name="step_count_non_negative"),
        Index("ix_anonymous_sessions_expires_at", "expires_at"),
    )

    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_versions.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    current_scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="RESTRICT")
    )
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    # Which engine (module[@version]) created ``state``; state is never fed
    # to a different engine.
    engine_id: Mapped[str] = mapped_column(String(255), nullable=False)
    step_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    occupation: Mapped[Occupation] = relationship()
    content_version: Mapped[ContentVersion] = relationship()
    current_scenario: Mapped[Scenario | None] = relationship()
    choices: Mapped[list[UserChoice]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="UserChoice.step_index"
    )


class UserChoice(UUIDPrimaryKeyMixin, db.Model):
    """An accepted, server-validated choice. One per scenario per session."""

    __tablename__ = "user_choices"
    __table_args__ = (
        UniqueConstraint("session_id", "step_index"),
        UniqueConstraint("session_id", "scenario_id"),
        CheckConstraint("step_index >= 1", name="step_index_positive"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anonymous_sessions.id", ondelete="CASCADE"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="RESTRICT"), nullable=False
    )
    choice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenario_choices.id", ondelete="RESTRICT"), nullable=False
    )
    state_after: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session: Mapped[AnonymousSession] = relationship(back_populates="choices")
    scenario: Mapped[Scenario] = relationship()
    choice: Mapped[ScenarioChoice] = relationship()


class FutureprintReport(UUIDPrimaryKeyMixin, db.Model):
    """An immutable report snapshot. A database trigger rejects updates to the
    snapshot, share-token hash, content version and creation time."""

    __tablename__ = "futureprint_reports"

    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anonymous_sessions.id", ondelete="SET NULL"), unique=True
    )
    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="RESTRICT"), nullable=False
    )
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_versions.id", ondelete="RESTRICT"), nullable=False
    )
    share_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    snapshot_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AIUsageRecord(UUIDPrimaryKeyMixin, db.Model):
    """Token usage and estimated cost of each AI insights call."""

    __tablename__ = "ai_usage_records"
    __table_args__ = (
        CheckConstraint("status IN ('success', 'error', 'cached')", name="status"),
        Index("ix_ai_usage_records_session_created", "session_id", "created_at"),
    )

    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anonymous_sessions.id", ondelete="SET NULL")
    )
    feature: Mapped[str] = mapped_column(String(60), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
