"""Read-only queries over curated content."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import (
    ContentVersion,
    EvidenceLink,
    EvidenceSource,
    Occupation,
    OccupationSkill,
    Pathway,
    Scenario,
    ScenarioChoice,
    Task,
    TaskSkill,
    WorkforceEvent,
    workforce_event_occupations,
)


def get_active_content_version() -> ContentVersion | None:
    return db.session.execute(select(ContentVersion).where(ContentVersion.is_active.is_(True))).scalar_one_or_none()


def list_occupations() -> Sequence[Occupation]:
    stmt = (
        select(Occupation)
        .options(selectinload(Occupation.tasks), selectinload(Occupation.pathways))
        .order_by(Occupation.display_order, Occupation.name)
    )
    return db.session.execute(stmt).scalars().all()


def scenario_counts_by_occupation() -> dict[uuid.UUID, int]:
    stmt = select(Scenario.occupation_id, func.count(Scenario.id)).group_by(Scenario.occupation_id)
    return {occ_id: count for occ_id, count in db.session.execute(stmt).all()}


def get_occupation_by_slug(slug: str) -> Occupation | None:
    return db.session.execute(select(Occupation).where(Occupation.slug == slug)).scalar_one_or_none()


def get_occupation_detail(slug: str) -> Occupation | None:
    stmt = (
        select(Occupation)
        .where(Occupation.slug == slug)
        .options(
            selectinload(Occupation.tasks).selectinload(Task.skill_links).selectinload(TaskSkill.skill),
            selectinload(Occupation.skill_links).selectinload(OccupationSkill.skill),
            selectinload(Occupation.pathways).selectinload(Pathway.skills),
        )
    )
    return db.session.execute(stmt).scalar_one_or_none()


def evidence_links_for(
    *,
    occupation_ids: Sequence[uuid.UUID] = (),
    task_ids: Sequence[uuid.UUID] = (),
    pathway_ids: Sequence[uuid.UUID] = (),
    scenario_ids: Sequence[uuid.UUID] = (),
    workforce_event_ids: Sequence[uuid.UUID] = (),
) -> Sequence[EvidenceLink]:
    conditions = []
    if occupation_ids:
        conditions.append(EvidenceLink.occupation_id.in_(occupation_ids))
    if task_ids:
        conditions.append(EvidenceLink.task_id.in_(task_ids))
    if pathway_ids:
        conditions.append(EvidenceLink.pathway_id.in_(pathway_ids))
    if scenario_ids:
        conditions.append(EvidenceLink.scenario_id.in_(scenario_ids))
    if workforce_event_ids:
        conditions.append(EvidenceLink.workforce_event_id.in_(workforce_event_ids))
    if not conditions:
        return []
    stmt = (
        select(EvidenceLink)
        .where(or_(*conditions))
        .options(selectinload(EvidenceLink.source))
        .join(EvidenceSource)
        .order_by(EvidenceSource.key)
    )
    return db.session.execute(stmt).scalars().all()


def workforce_events_for_occupation(occupation_id: uuid.UUID) -> Sequence[WorkforceEvent]:
    stmt = (
        select(WorkforceEvent)
        .join(workforce_event_occupations)
        .where(workforce_event_occupations.c.occupation_id == occupation_id)
        .options(selectinload(WorkforceEvent.company), selectinload(WorkforceEvent.primary_source))
        .order_by(WorkforceEvent.event_date.desc())
    )
    return db.session.execute(stmt).scalars().all()


def list_workforce_events() -> Sequence[WorkforceEvent]:
    stmt = (
        select(WorkforceEvent)
        .options(
            selectinload(WorkforceEvent.company),
            selectinload(WorkforceEvent.primary_source),
            selectinload(WorkforceEvent.occupations),
        )
        .order_by(WorkforceEvent.event_date.desc())
    )
    return db.session.execute(stmt).scalars().all()


def list_sources(region: str | None = None, category: str | None = None) -> Sequence[EvidenceSource]:
    stmt = select(EvidenceSource).order_by(EvidenceSource.organisation, EvidenceSource.key)
    if region:
        stmt = stmt.where(EvidenceSource.region == region)
    if category:
        stmt = stmt.where(EvidenceSource.evidence_category == category)
    return db.session.execute(stmt).scalars().all()


def get_source(key: str) -> EvidenceSource | None:
    return db.session.execute(select(EvidenceSource).where(EvidenceSource.key == key)).scalar_one_or_none()


def links_for_source(source_id: uuid.UUID) -> Sequence[EvidenceLink]:
    return db.session.execute(select(EvidenceLink).where(EvidenceLink.evidence_source_id == source_id)).scalars().all()


def names_for(model: type, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, object]:
    if not ids:
        return {}
    return {row.id: row for row in db.session.execute(select(model).where(model.id.in_(ids))).scalars()}


def get_start_scenario(occupation_id: uuid.UUID) -> Scenario | None:
    stmt = select(Scenario).where(Scenario.occupation_id == occupation_id, Scenario.is_start.is_(True))
    return db.session.execute(stmt).scalar_one_or_none()


def get_simulation_graph(occupation_id: uuid.UUID) -> tuple[Sequence[Scenario], Sequence[Pathway]]:
    scenarios = (
        db.session.execute(
            select(Scenario)
            .where(Scenario.occupation_id == occupation_id)
            .options(selectinload(Scenario.choices), selectinload(Scenario.task))
            .order_by(Scenario.display_order, Scenario.key)
        )
        .scalars()
        .all()
    )
    pathways = (
        db.session.execute(
            select(Pathway)
            .where(Pathway.occupation_id == occupation_id)
            .options(selectinload(Pathway.skills))
            .order_by(Pathway.display_order, Pathway.slug)
        )
        .scalars()
        .all()
    )
    return scenarios, pathways


def get_choice(choice_id: uuid.UUID) -> ScenarioChoice | None:
    return db.session.get(ScenarioChoice, choice_id)
