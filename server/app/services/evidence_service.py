"""Evidence, workforce event and methodology transparency use cases."""

from __future__ import annotations

from typing import Any

from app.errors import NotFound, ServiceUnavailable
from app.models import Occupation, Pathway, Scenario, Task, WorkforceEvent
from app.repositories import content_repository
from app.services import serializers as s


def list_sources(region: str | None, category: str | None) -> dict[str, Any]:
    sources = content_repository.list_sources(region=region, category=category)
    return {"sources": [s.source_summary(src) for src in sources], "count": len(sources)}


def get_source(key: str) -> dict[str, Any]:
    source = content_repository.get_source(key)
    if source is None:
        raise NotFound("Evidence source not found.", code="source_not_found")
    links = content_repository.links_for_source(source.id)
    occupations = content_repository.names_for(Occupation, [l.occupation_id for l in links if l.occupation_id])
    tasks = content_repository.names_for(Task, [l.task_id for l in links if l.task_id])
    pathways = content_repository.names_for(Pathway, [l.pathway_id for l in links if l.pathway_id])
    scenarios = content_repository.names_for(Scenario, [l.scenario_id for l in links if l.scenario_id])
    events = content_repository.names_for(WorkforceEvent, [l.workforce_event_id for l in links if l.workforce_event_id])
    used_by = []
    for link in links:
        if link.occupation_id:
            o = occupations[link.occupation_id]
            used_by.append({"type": "occupation", "slug": o.slug, "name": o.name, "relevance": link.note})
        elif link.task_id:
            t = tasks[link.task_id]
            used_by.append({"type": "task", "slug": t.slug, "name": t.title, "relevance": link.note})
        elif link.pathway_id:
            p = pathways[link.pathway_id]
            used_by.append({"type": "pathway", "slug": p.slug, "name": p.title, "relevance": link.note})
        elif link.scenario_id:
            sc = scenarios[link.scenario_id]
            used_by.append({"type": "scenario", "slug": sc.key, "name": sc.title, "relevance": link.note})
        elif link.workforce_event_id:
            e = events[link.workforce_event_id]
            used_by.append({"type": "workforce_event", "slug": e.slug, "name": e.title, "relevance": link.note})
    return {"source": s.source_detail(source), "used_by": used_by}


def list_workforce_events() -> dict[str, Any]:
    events = content_repository.list_workforce_events()
    return {"events": [s.workforce_event(e, include_occupations=True) for e in events], "count": len(events)}


def methodology() -> dict[str, Any]:
    version = content_repository.get_active_content_version()
    if version is None:
        raise ServiceUnavailable("Content has not been loaded yet.", code="content_not_loaded")
    manifest = version.manifest or {}
    return {
        "content_version": version.version,
        "loaded_at": s.iso(version.loaded_at),
        "retrieved_through": manifest.get("retrieved_through"),
        "description": manifest.get("description"),
        "methodology": manifest.get("methodology", {}),
        "counts": manifest.get("counts", {}),
    }
