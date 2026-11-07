"""Shared column mixins and enumerations for the data model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

# Enumerations are stored as text with CHECK constraints rather than native
# PostgreSQL ENUM types: adding a value then needs no ALTER TYPE migration.
EXPOSURE_GRADIENTS = (
    "not_exposed",
    "minimal_exposure",
    "gradient_1",
    "gradient_2",
    "gradient_3",
    "gradient_4",
)
TASK_EXPOSURE_LEVELS = ("very_low", "low", "medium", "high")
LIKELY_CHANGES = ("mostly_human", "augmentation", "partial_automation")
REGIONS = ("kenya", "africa", "global", "outside_africa")
EVIDENCE_CATEGORIES = (
    "ai_exposure_research",
    "labour_statistics",
    "employment_projection",
    "productivity_study",
    "workforce_event",
    "policy_guidance",
    "sector_report",
)
CONFIDENCE_LEVELS = ("high", "medium", "low")
SKILL_CATEGORIES = ("digital", "technical", "human", "domain", "ai")
SKILL_IMPORTANCE = ("core", "supporting", "emerging")
PATHWAY_KINDS = ("adapt", "transform", "discover")
EVENT_TYPES = ("ai_deployment", "workforce_reduction", "skills_programme", "technology_adoption")
SESSION_STATUSES = ("active", "completed")


def sql_in(column: str, values: tuple[str, ...]) -> str:
    """Render a CHECK constraint expression restricting a column to values."""
    quoted = ", ".join(f"'{v}'" for v in values)  # constants only, never user input
    return f"{column} IN ({quoted})"


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
