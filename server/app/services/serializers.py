"""Convert ORM objects into JSON-ready dicts for API responses and snapshots."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.models import EvidenceLink, EvidenceSource, Occupation, Pathway, Skill, Task, WorkforceEvent

EXPOSURE_GRADIENT_LABELS = {
    "not_exposed": "Not exposed",
    "minimal_exposure": "Minimal exposure",
    "gradient_1": "Exposed: Gradient 1 (low exposure, high task variability)",
    "gradient_2": "Exposed: Gradient 2 (moderate exposure, high task variability)",
    "gradient_3": "Exposed: Gradient 3 (significant exposure, high task variability)",
    "gradient_4": "Exposed: Gradient 4 (highest exposure, low task variability)",
}


def iso(value: datetime | date | None) -> str | None:
    return value.isoformat() if value is not None else None


def num(value: Decimal | float | None) -> float | None:
    return float(value) if value is not None else None


def skill_summary(skill: Skill) -> dict[str, Any]:
    return {"slug": skill.slug, "name": skill.name, "category": skill.category}


def source_summary(source: EvidenceSource) -> dict[str, Any]:
    return {
        "key": source.key,
        "organisation": source.organisation,
        "title": source.title,
        "url": source.url,
        "publication_date": source.publication_date,
        "region": source.region,
        "is_african_evidence": source.region in ("kenya", "africa"),
        "evidence_category": source.evidence_category,
        "source_type": source.source_type,
        "confidence": source.confidence,
    }


def source_detail(source: EvidenceSource) -> dict[str, Any]:
    return {
        **source_summary(source),
        "authors": source.authors,
        "retrieved_on": iso(source.retrieved_on),
        "geographic_scope": source.geographic_scope,
        "summary": source.summary,
        "findings": source.findings,
        "limitations": source.limitations,
    }


def evidence_reference(link: EvidenceLink) -> dict[str, Any]:
    return {**source_summary(link.source), "relevance": link.note}


def exposure(occupation: Occupation) -> dict[str, Any]:
    return {
        "gradient": occupation.exposure_gradient,
        "gradient_label": EXPOSURE_GRADIENT_LABELS[occupation.exposure_gradient],
        "label": occupation.exposure_label,
        "ilo_mean_score": num(occupation.exposure_mean_score),
        "ilo_score_sd": num(occupation.exposure_score_sd),
        "summary": occupation.exposure_summary,
        "measures": "potential exposure of tasks to generative AI, not job loss",
    }


def task(task: Task, evidence: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "slug": task.slug,
        "title": task.title,
        "isco_task_statement": task.isco_task_statement,
        "exposure": {
            "level": task.exposure_level,
            "ilo_task_score": num(task.ilo_task_score),
            "basis": task.exposure_basis,
        },
        "likely_change": task.likely_change,
        "transformation_note": task.transformation_note,
        "skills": [skill_summary(link.skill) for link in sorted(task.skill_links, key=lambda l: l.skill.name)],
        "evidence": evidence or [],
    }


def pathway(pathway: Pathway, evidence: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "slug": pathway.slug,
        "kind": pathway.kind,
        "title": pathway.title,
        "summary": pathway.summary,
        "steps": pathway.steps,
        "target_roles": pathway.target_roles,
        "skills": [skill_summary(s) for s in pathway.skills],
        "is_illustrative": pathway.is_illustrative,
        "evidence": evidence or [],
    }


def workforce_event(event: WorkforceEvent, include_occupations: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "slug": event.slug,
        "title": event.title,
        "event_date": iso(event.event_date),
        "event_type": event.event_type,
        "company": (
            {
                "slug": event.company.slug,
                "name": event.company.name,
                "headquarters_country": event.company.headquarters_country,
                "sector": event.company.sector,
            }
            if event.company
            else None
        ),
        "summary": event.summary,
        "reported_figures": event.reported_figures,
        "interpretation_note": event.interpretation_note,
        "geographic_scope": event.geographic_scope,
        "region": event.region,
        "is_african_evidence": event.region in ("kenya", "africa"),
        "primary_source": source_summary(event.primary_source),
    }
    if include_occupations:
        data["occupations"] = [{"slug": o.slug, "name": o.name} for o in event.occupations]
    return data
