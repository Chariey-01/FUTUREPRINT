"""Builds the plain-dict ``content`` structure passed to the scenario engine."""

from __future__ import annotations

from typing import Any

from flask import current_app

from app.engine.adapter import EngineAdapter
from app.errors import ServiceUnavailable
from app.models import ContentVersion, Occupation
from app.repositories import content_repository


def get_engine() -> EngineAdapter:
    from app import ENGINE_KEY

    return current_app.extensions[ENGINE_KEY]


def build_engine_content(occupation: Occupation, content_version: ContentVersion) -> dict[str, Any]:
    scenarios, pathways = content_repository.get_simulation_graph(occupation.id)
    if not scenarios:
        raise ServiceUnavailable("No simulation is available for this occupation.", code="simulation_unavailable")
    start = next((sc for sc in scenarios if sc.is_start), None)
    if start is None:
        raise ServiceUnavailable("The simulation has no start scenario.", code="simulation_unavailable")
    return {
        "content_version": content_version.version,
        "occupation": {"id": str(occupation.id), "slug": occupation.slug, "name": occupation.name},
        "start_scenario_id": str(start.id),
        "scenarios": {
            str(sc.id): {
                "id": str(sc.id),
                "key": sc.key,
                "title": sc.title,
                "narrative": sc.narrative,
                "task": (
                    {"slug": sc.task.slug, "title": sc.task.title, "exposure_level": sc.task.exposure_level}
                    if sc.task
                    else None
                ),
                "choices": [
                    {
                        "id": str(ch.id),
                        "key": ch.key,
                        "label": ch.label,
                        "description": ch.description,
                        "feedback": ch.feedback,
                        "pathway_kind": ch.pathway_kind,
                        "effects": ch.effects,
                        "next_scenario_id": str(ch.next_scenario_id) if ch.next_scenario_id else None,
                    }
                    for ch in sc.choices
                ],
            }
            for sc in scenarios
        },
        "pathways": [
            {
                "id": str(p.id),
                "slug": p.slug,
                "kind": p.kind,
                "title": p.title,
                "summary": p.summary,
                "steps": p.steps,
                "target_roles": p.target_roles,
                "skills": [{"slug": sk.slug, "name": sk.name} for sk in p.skills],
            }
            for p in pathways
        ],
    }
