"""Database writes for the seed loader (the only place content is mutated)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Company,
    ContentVersion,
    EvidenceLink,
    EvidenceSource,
    Occupation,
    OccupationSkill,
    Pathway,
    Scenario,
    ScenarioChoice,
    Skill,
    Task,
    TaskSkill,
    WorkforceEvent,
    pathway_skills,
    workforce_event_occupations,
)

logger = logging.getLogger(__name__)

# Parent -> child order. Natural keys determine ids *and* unique columns, so
# upserting by id can never collide on a unique slug.
ENTITY_MODELS: list[tuple[str, Any]] = [
    ("evidence_sources", EvidenceSource),
    ("skills", Skill),
    ("companies", Company),
    ("occupations", Occupation),
    ("tasks", Task),
    ("pathways", Pathway),
    ("scenarios", Scenario),
    ("scenario_choices", ScenarioChoice),
    ("workforce_events", WorkforceEvent),
]
ASSOCIATION_TABLES: list[tuple[str, Any]] = [
    ("occupation_skills", OccupationSkill.__table__),
    ("task_skills", TaskSkill.__table__),
    ("pathway_skills", pathway_skills),
    ("workforce_event_occupations", workforce_event_occupations),
    ("evidence_links", EvidenceLink.__table__),
]
_PRUNE_ORDER = [
    "workforce_events",
    "scenario_choices",
    "scenarios",
    "pathways",
    "tasks",
    "occupations",
    "companies",
    "skills",
    "evidence_sources",
]


class SeedConflictError(RuntimeError):
    """Removing content that user sessions or reports still reference."""


def apply_dataset(
    rows: dict[str, list[dict[str, Any]]], *, version: str, checksum: str, manifest: dict[str, Any]
):  # -> LoadResult (imported lazily to avoid a cycle)
    from app.seed.loader import LoadResult

    session = db.session
    models = dict(ENTITY_MODELS)
    try:
        # 1. Association rows are fully owned by the seed files: rebuild them.
        for _, table in ASSOCIATION_TABLES:
            session.execute(delete(table))
        # 2. Clear self-referencing pointers that the upsert will set again.
        session.execute(update(Scenario).values(is_start=False))
        session.execute(update(ScenarioChoice).values(next_scenario_id=None))
        # 3. Upsert entities (parents first).
        counts: dict[str, int] = {}
        for name, model in ENTITY_MODELS:
            batch = rows.get(name, [])
            counts[name] = len(batch)
            if not batch:
                continue
            stmt = pg_insert(model.__table__).values(batch)
            set_ = {col: stmt.excluded[col] for col in batch[0] if col != "id"}
            if "updated_at" in model.__table__.c:
                set_["updated_at"] = func.now()
            session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=set_))
        # 4. Prune entities that are no longer in the seed (children first).
        pruned: dict[str, int] = {}
        for name in _PRUNE_ORDER:
            model = models[name]
            keep = [r["id"] for r in rows.get(name, [])]
            stmt = delete(model).where(model.id.not_in(keep)) if keep else delete(model)
            result = session.execute(stmt)
            if result.rowcount:
                pruned[name] = result.rowcount
        # 5. Re-insert association rows.
        for name, table in ASSOCIATION_TABLES:
            batch = rows.get(name, [])
            counts[name] = len(batch)
            if batch:
                session.execute(table.insert().values(batch))
        # 6. Activate the content version for this checksum.
        existing = session.execute(
            select(ContentVersion).where(ContentVersion.checksum == checksum)
        ).scalar_one_or_none()
        session.execute(
            update(ContentVersion).where(ContentVersion.is_active.is_(True)).values(is_active=False)
        )
        session.flush()
        if existing is None:
            session.add(ContentVersion(version=version, checksum=checksum, manifest=manifest, is_active=True))
        else:
            existing.is_active = True
            existing.manifest = manifest
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        logger.error("seed_load_conflict", extra={"constraint": getattr(exc.orig, "diag", None) and exc.orig.diag.constraint_name})
        raise SeedConflictError(
            "Seed load rolled back: content removed from the seed files is still referenced by "
            "user sessions or reports, or a database constraint was violated."
        ) from exc
    except Exception:
        session.rollback()
        raise
    logger.info("seed_loaded", extra={"version": version, "created_version": existing is None})
    return LoadResult(
        version=version, checksum=checksum, created_version=existing is None, counts=counts, pruned=pruned
    )
