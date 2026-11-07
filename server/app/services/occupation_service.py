"""Occupation exploration use cases."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.errors import NotFound, ServiceUnavailable
from app.repositories import content_repository
from app.services import serializers as s


def _content_version() -> str:
    version = content_repository.get_active_content_version()
    if version is None:
        raise ServiceUnavailable("Content has not been loaded yet.", code="content_not_loaded")
    return version.version


def list_occupations() -> dict[str, Any]:
    version = _content_version()
    scenario_counts = content_repository.scenario_counts_by_occupation()
    items = []
    for occ in content_repository.list_occupations():
        items.append(
            {
                "slug": occ.slug,
                "name": occ.name,
                "category": occ.category,
                "summary": occ.summary,
                "isco_08_code": occ.isco_08_code,
                "exposure": {
                    "gradient": occ.exposure_gradient,
                    "gradient_label": s.EXPOSURE_GRADIENT_LABELS[occ.exposure_gradient],
                    "ilo_mean_score": s.num(occ.exposure_mean_score),
                },
                "task_count": len(occ.tasks),
                "pathway_kinds": sorted({p.kind for p in occ.pathways}),
                "simulation_available": scenario_counts.get(occ.id, 0) > 0,
            }
        )
    return {"content_version": version, "occupations": items}


def get_occupation(slug: str) -> dict[str, Any]:
    version = _content_version()
    occ = content_repository.get_occupation_detail(slug)
    if occ is None:
        raise NotFound("Occupation not found.", code="occupation_not_found")

    links = content_repository.evidence_links_for(
        occupation_ids=[occ.id],
        task_ids=[t.id for t in occ.tasks],
        pathway_ids=[p.id for p in occ.pathways],
    )
    by_task: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    by_pathway: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    occupation_evidence = []
    all_sources: dict[str, dict[str, Any]] = {}
    for link in links:
        ref = s.evidence_reference(link)
        all_sources[link.source.key] = s.source_summary(link.source)
        if link.occupation_id:
            occupation_evidence.append(ref)
        elif link.task_id:
            by_task[link.task_id].append(ref)
        elif link.pathway_id:
            by_pathway[link.pathway_id].append(ref)

    events = content_repository.workforce_events_for_occupation(occ.id)
    for event in events:
        all_sources[event.primary_source.key] = s.source_summary(event.primary_source)
    scenario_count = content_repository.scenario_counts_by_occupation().get(occ.id, 0)
    skills = sorted(occ.skill_links, key=lambda l: ({"core": 0, "supporting": 1, "emerging": 2}[l.importance], l.skill.name))

    return {
        "content_version": version,
        "occupation": {
            "slug": occ.slug,
            "name": occ.name,
            "category": occ.category,
            "isco_08_code": occ.isco_08_code,
            "isco_08_title": occ.isco_08_title,
            "summary": occ.summary,
            "description": occ.description,
            "responsibilities": occ.responsibilities,
            "kenya_context": occ.kenya_context,
            "limitations": occ.limitations,
            "exposure": s.exposure(occ),
        },
        "tasks": [s.task(t, by_task.get(t.id)) for t in occ.tasks],
        "skills": [{**s.skill_summary(l.skill), "importance": l.importance, "description": l.skill.description} for l in skills],
        "pathways": [s.pathway(p, by_pathway.get(p.id)) for p in occ.pathways],
        "evidence": occupation_evidence,
        "workforce_events": [s.workforce_event(e) for e in events],
        "sources": sorted(all_sources.values(), key=lambda x: x["key"]),
        "simulation": {"available": scenario_count > 0, "scenario_count": scenario_count},
    }
