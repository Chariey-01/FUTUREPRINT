"""Runs the engine conformance checker against the loaded content."""

from __future__ import annotations

from app.engine.conformance import ConformanceReport, check_engine
from app.errors import NotFound, ServiceUnavailable
from app.repositories import content_repository
from app.services.content_service import build_engine_content, get_engine


def run_conformance(occupation_slug: str | None = None, *, max_steps: int = 50) -> list[ConformanceReport]:
    version = content_repository.get_active_content_version()
    if version is None:
        raise ServiceUnavailable("Content has not been loaded yet.", code="content_not_loaded")
    occupations = list(content_repository.list_occupations())
    if occupation_slug is not None:
        occupations = [o for o in occupations if o.slug == occupation_slug]
        if not occupations:
            raise NotFound("Occupation not found.", code="occupation_not_found")
    engine = get_engine()
    reports = []
    for occupation in occupations:
        try:
            content = build_engine_content(occupation, version)
        except ServiceUnavailable:  # occupation without a simulation
            continue
        reports.append(check_engine(engine, content, max_steps=max_steps))
    return reports
