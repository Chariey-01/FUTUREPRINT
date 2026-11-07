"""Curated research content: occupations, tasks, skills, evidence and scenarios.

Content rows use deterministic UUIDs derived from their seed-data keys (see
``app.seed.ids``) so that re-running the seed loader updates rows in place
and identifiers stay stable across environments and reloads.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import (
    CONFIDENCE_LEVELS,
    EVENT_TYPES,
    EVIDENCE_CATEGORIES,
    EXPOSURE_GRADIENTS,
    LIKELY_CHANGES,
    PATHWAY_KINDS,
    REGIONS,
    SKILL_CATEGORIES,
    SKILL_IMPORTANCE,
    TASK_EXPOSURE_LEVELS,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    sql_in,
)

PARTIAL_DATE_CHECK = r"publication_date IS NULL OR publication_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'"

# --- association tables -----------------------------------------------------

pathway_skills = Table(
    "pathway_skills",
    db.metadata,
    Column("pathway_id", UUID(as_uuid=True), ForeignKey("pathways.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)

workforce_event_occupations = Table(
    "workforce_event_occupations",
    db.metadata,
    Column(
        "workforce_event_id",
        UUID(as_uuid=True),
        ForeignKey("workforce_events.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "occupation_id", UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), primary_key=True
    ),
)


class ContentVersion(UUIDPrimaryKeyMixin, db.Model):
    """One loaded revision of the curated seed dataset."""

    __tablename__ = "content_versions"
    __table_args__ = (
        Index(
            "uq_content_versions_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    version: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    manifest: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    loaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class EvidenceSource(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A citable publication, dataset or official statement."""

    __tablename__ = "evidence_sources"
    __table_args__ = (
        CheckConstraint(sql_in("evidence_category", EVIDENCE_CATEGORIES), name="evidence_category"),
        CheckConstraint(sql_in("region", REGIONS), name="region"),
        CheckConstraint(sql_in("confidence", CONFIDENCE_LEVELS), name="confidence"),
        CheckConstraint(PARTIAL_DATE_CHECK, name="publication_date_format"),
        Index("ix_evidence_sources_region_category", "region", "evidence_category"),
    )

    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    organisation: Mapped[str] = mapped_column(String(300), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    publication_date: Mapped[str | None] = mapped_column(String(10))
    retrieved_on: Mapped[date] = mapped_column(Date, nullable=False)
    evidence_category: Mapped[str] = mapped_column(String(40), nullable=False)
    geographic_scope: Mapped[str] = mapped_column(String(300), nullable=False)
    region: Mapped[str] = mapped_column(String(20), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="primary")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    findings: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False)
    limitations: Mapped[str] = mapped_column(Text, nullable=False)

    links: Mapped[list[EvidenceLink]] = relationship(back_populates="source", cascade="all, delete-orphan")


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "skills"
    __table_args__ = (CheckConstraint(sql_in("category", SKILL_CATEGORIES), name="category"),)

    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class Occupation(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "occupations"
    __table_args__ = (
        CheckConstraint(sql_in("exposure_gradient", EXPOSURE_GRADIENTS), name="exposure_gradient"),
        CheckConstraint(
            "exposure_mean_score IS NULL OR (exposure_mean_score >= 0 AND exposure_mean_score <= 1)",
            name="exposure_mean_score_range",
        ),
    )

    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    isco_08_code: Mapped[str | None] = mapped_column(String(4))
    isco_08_title: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    responsibilities: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    exposure_gradient: Mapped[str] = mapped_column(String(20), nullable=False)
    exposure_label: Mapped[str] = mapped_column(String(120), nullable=False)
    exposure_mean_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    exposure_score_sd: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    exposure_summary: Mapped[str] = mapped_column(Text, nullable=False)
    kenya_context: Mapped[str] = mapped_column(Text, nullable=False)
    limitations: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    tasks: Mapped[list[Task]] = relationship(
        back_populates="occupation", cascade="all, delete-orphan", order_by="Task.display_order"
    )
    skill_links: Mapped[list[OccupationSkill]] = relationship(
        back_populates="occupation", cascade="all, delete-orphan"
    )
    pathways: Mapped[list[Pathway]] = relationship(
        back_populates="occupation", cascade="all, delete-orphan", order_by="Pathway.display_order"
    )
    scenarios: Mapped[list[Scenario]] = relationship(
        back_populates="occupation",
        cascade="all, delete-orphan",
        order_by="Scenario.display_order",
        foreign_keys="Scenario.occupation_id",
    )


class OccupationSkill(db.Model):
    __tablename__ = "occupation_skills"
    __table_args__ = (CheckConstraint(sql_in("importance", SKILL_IMPORTANCE), name="importance"),)

    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True
    )
    importance: Mapped[str] = mapped_column(String(20), nullable=False)

    occupation: Mapped[Occupation] = relationship(back_populates="skill_links")
    skill: Mapped[Skill] = relationship()


class Task(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("occupation_id", "slug"),
        CheckConstraint(sql_in("exposure_level", TASK_EXPOSURE_LEVELS), name="exposure_level"),
        CheckConstraint(sql_in("likely_change", LIKELY_CHANGES), name="likely_change"),
        CheckConstraint(
            "ilo_task_score IS NULL OR (ilo_task_score >= 0 AND ilo_task_score <= 1)",
            name="ilo_task_score_range",
        ),
    )

    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    isco_task_statement: Mapped[str | None] = mapped_column(Text)
    ilo_task_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    exposure_level: Mapped[str] = mapped_column(String(20), nullable=False)
    exposure_basis: Mapped[str] = mapped_column(String(200), nullable=False)
    likely_change: Mapped[str] = mapped_column(String(30), nullable=False)
    transformation_note: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    occupation: Mapped[Occupation] = relationship(back_populates="tasks")
    skill_links: Mapped[list[TaskSkill]] = relationship(back_populates="task", cascade="all, delete-orphan")


class TaskSkill(db.Model):
    __tablename__ = "task_skills"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True
    )

    task: Mapped[Task] = relationship(back_populates="skill_links")
    skill: Mapped[Skill] = relationship()


class Company(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "companies"

    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    headquarters_country: Mapped[str] = mapped_column(String(120), nullable=False)
    sector: Mapped[str] = mapped_column(String(200), nullable=False)
    website: Mapped[str | None] = mapped_column(String(2048))


class WorkforceEvent(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """A verified, publicly announced workforce event."""

    __tablename__ = "workforce_events"
    __table_args__ = (
        CheckConstraint(sql_in("event_type", EVENT_TYPES), name="event_type"),
        CheckConstraint(sql_in("region", REGIONS), name="region"),
        Index("ix_workforce_events_event_date", "event_date"),
    )

    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), index=True
    )
    primary_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evidence_sources.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    reported_figures: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    interpretation_note: Mapped[str] = mapped_column(Text, nullable=False)
    geographic_scope: Mapped[str] = mapped_column(String(300), nullable=False)
    region: Mapped[str] = mapped_column(String(20), nullable=False)

    company: Mapped[Company | None] = relationship()
    primary_source: Mapped[EvidenceSource] = relationship()
    occupations: Mapped[list[Occupation]] = relationship(secondary=workforce_event_occupations)


class Pathway(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """An Adapt, Transform or Discover career pathway for an occupation."""

    __tablename__ = "pathways"
    __table_args__ = (
        UniqueConstraint("occupation_id", "slug"),
        CheckConstraint(sql_in("kind", PATHWAY_KINDS), name="kind"),
    )

    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    target_roles: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    is_illustrative: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    occupation: Mapped[Occupation] = relationship(back_populates="pathways")
    skills: Mapped[list[Skill]] = relationship(secondary=pathway_skills, order_by="Skill.name")


class Scenario(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """One decision point in an occupation's illustrative simulation."""

    __tablename__ = "scenarios"
    __table_args__ = (
        UniqueConstraint("occupation_id", "key"),
        Index(
            "uq_scenarios_single_start_per_occupation",
            "occupation_id",
            unique=True,
            postgresql_where=text("is_start"),
        ),
    )

    occupation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL")
    )
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    is_start: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_illustrative: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    occupation: Mapped[Occupation] = relationship(back_populates="scenarios", foreign_keys=[occupation_id])
    task: Mapped[Task | None] = relationship()
    choices: Mapped[list[ScenarioChoice]] = relationship(
        back_populates="scenario",
        cascade="all, delete-orphan",
        order_by="ScenarioChoice.display_order",
        foreign_keys="ScenarioChoice.scenario_id",
    )


class ScenarioChoice(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "scenario_choices"
    __table_args__ = (
        UniqueConstraint("scenario_id", "key"),
        CheckConstraint(f"pathway_kind IS NULL OR {sql_in('pathway_kind', PATHWAY_KINDS)}", name="pathway_kind"),
        CheckConstraint("next_scenario_id IS NULL OR next_scenario_id <> scenario_id", name="no_self_loop"),
    )

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    next_scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="RESTRICT")
    )
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    pathway_kind: Mapped[str | None] = mapped_column(String(20))
    effects: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scenario: Mapped[Scenario] = relationship(back_populates="choices", foreign_keys=[scenario_id])


class EvidenceLink(UUIDPrimaryKeyMixin, db.Model):
    """Connects an evidence source to exactly one piece of content."""

    __tablename__ = "evidence_links"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(occupation_id, task_id, pathway_id, scenario_id, workforce_event_id) = 1",
            name="exactly_one_target",
        ),
        UniqueConstraint(
            "evidence_source_id",
            "occupation_id",
            "task_id",
            "pathway_id",
            "scenario_id",
            "workforce_event_id",
            name="uq_evidence_links_source_target",
            postgresql_nulls_not_distinct=True,
        ),
    )

    evidence_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evidence_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    occupation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("occupations.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    pathway_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pathways.id", ondelete="CASCADE"), index=True
    )
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), index=True
    )
    workforce_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workforce_events.id", ondelete="CASCADE"), index=True
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)

    source: Mapped[EvidenceSource] = relationship(back_populates="links")
