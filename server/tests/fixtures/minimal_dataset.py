"""A tiny, self-contained seed dataset for tests.

It is deliberately separate from the real research data so that curating
``seed_data/`` never breaks unrelated tests. Values here are test fixtures,
not research claims.

Simulation graph for ``test-occupation``::

    s1 --a--> s2 --a--> (end)
    s1 --b--> s2 --b--> s3 --a/b--> (end)
    s1 --c--> s3
"""

from __future__ import annotations

import copy
from typing import Any

_EVIDENCE = [{"source": "test-source", "note": "Fixture evidence link for testing."}]

_DATASET: dict[str, Any] = {
    "manifest.json": {
        "dataset_version": "test.1",
        "retrieved_through": "2026-01-01",
        "description": "Minimal fixture dataset used by the automated tests.",
        "validation_rules": {"min_tasks_per_occupation": 1, "require_all_pathway_kinds": True, "require_simulation_per_occupation": True},
        "methodology": {"purpose": "testing"},
    },
    "evidence_sources.json": {
        "sources": [
            {
                "key": "test-source",
                "organisation": "Test Organisation",
                "title": "Test publication",
                "authors": ["A. Tester"],
                "url": "https://example.org/test",
                "publication_date": "2025-01",
                "retrieved_on": "2026-01-01",
                "evidence_category": "ai_exposure_research",
                "geographic_scope": "Global",
                "region": "global",
                "summary": "A fixture source used only in tests.",
                "findings": [{"statement": "A fixture finding used only in tests.", "verbatim": False}],
                "confidence": "low",
                "limitations": "Not real evidence; test fixture only.",
            },
            {
                "key": "kenya-source",
                "organisation": "Kenyan Test Body",
                "title": "Kenyan fixture",
                "url": "https://example.org/kenya",
                "publication_date": None,
                "retrieved_on": "2026-01-01",
                "evidence_category": "labour_statistics",
                "geographic_scope": "Kenya",
                "region": "kenya",
                "summary": "A Kenyan fixture source used only in tests.",
                "findings": [{"statement": "Another fixture finding for tests.", "verbatim": False}],
                "confidence": "medium",
                "limitations": "Not real evidence; test fixture only.",
            },
        ]
    },
    "skills.json": {
        "skills": [
            {"slug": "skill-a", "name": "Skill A", "category": "human", "description": "Fixture skill A for tests."},
            {"slug": "skill-b", "name": "Skill B", "category": "digital", "description": "Fixture skill B for tests."},
        ]
    },
    "occupations.json": {
        "occupations": [
            {
                "slug": slug,
                "name": name,
                "category": "Testing",
                "isco_08_code": "9999",
                "isco_08_title": "Fixture occupation",
                "summary": "Fixture occupation summary for tests.",
                "description": "Fixture occupation description for tests.",
                "responsibilities": ["One", "Two", "Three"],
                "exposure": {"gradient": "gradient_2", "label": "Fixture", "mean_score": 0.45, "score_sd": 0.1, "summary": "Fixture exposure summary."},
                "kenya_context": "Fixture Kenya context for tests.",
                "limitations": "Fixture limitations for tests.",
                "skills": [{"skill": "skill-a", "importance": "core"}, {"skill": "skill-b", "importance": "emerging"}],
                "evidence": [{"source": "test-source", "note": "Fixture occupation evidence."}, {"source": "kenya-source", "note": "Fixture Kenyan evidence."}],
                "display_order": order,
            }
            for order, (slug, name) in enumerate([("test-occupation", "Test Occupation"), ("other-occupation", "Other Occupation")])
        ]
    },
    "tasks.json": {
        "tasks": [
            {
                "occupation": occ,
                "slug": "task-one",
                "title": "Task one",
                "isco_task_statement": "Doing the first fixture task.",
                "ilo_task_score": 0.6,
                "exposure_level": "medium",
                "exposure_basis": "fixture",
                "likely_change": "augmentation",
                "transformation_note": "Fixture transformation note.",
                "skills": ["skill-a"],
                "evidence": _EVIDENCE,
                "display_order": 1,
            }
            for occ in ("test-occupation", "other-occupation")
        ]
    },
    "pathways.json": {
        "pathways": [
            {
                "occupation": occ,
                "slug": f"{kind}-path",
                "kind": kind,
                "title": f"{kind.title()} pathway",
                "summary": f"Fixture {kind} pathway summary.",
                "steps": ["Step one", "Step two"],
                "target_roles": ["Role"],
                "skills": ["skill-b"],
                "evidence": _EVIDENCE,
                "display_order": i,
            }
            for occ in ("test-occupation", "other-occupation")
            for i, kind in enumerate(("adapt", "transform", "discover"))
        ]
    },
    "scenarios.json": {
        "scenarios": [
            {
                "occupation": "test-occupation",
                "key": "s1",
                "is_start": True,
                "task": "task-one",
                "title": "Scenario one",
                "narrative": "Fixture narrative for scenario one.",
                "choices": [
                    {"key": "a", "label": "Adapt", "description": "Fixture choice A.", "feedback": "Fixture feedback A.", "pathway_kind": "adapt", "effects": {"ai_fluency": 2}, "next": "s2"},
                    {"key": "b", "label": "Transform", "description": "Fixture choice B.", "feedback": "Fixture feedback B.", "pathway_kind": "transform", "effects": {"adaptability": 1}, "next": "s2"},
                    {"key": "c", "label": "Discover", "description": "Fixture choice C.", "feedback": "Fixture feedback C.", "pathway_kind": "discover", "effects": {"technical_depth": 1}, "next": "s3"},
                ],
                "evidence": _EVIDENCE,
                "display_order": 1,
            },
            {
                "occupation": "test-occupation",
                "key": "s2",
                "title": "Scenario two",
                "narrative": "Fixture narrative for scenario two.",
                "choices": [
                    {"key": "a", "label": "Finish", "description": "Fixture finishing choice.", "feedback": "Fixture feedback finish.", "pathway_kind": "adapt", "effects": {"judgement": 1}, "next": None},
                    {"key": "b", "label": "Continue", "description": "Fixture continue choice.", "feedback": "Fixture feedback continue.", "pathway_kind": "discover", "effects": {}, "next": "s3"},
                ],
                "display_order": 2,
            },
            {
                "occupation": "test-occupation",
                "key": "s3",
                "title": "Scenario three",
                "narrative": "Fixture narrative for scenario three.",
                "choices": [
                    {"key": "a", "label": "End A", "description": "Fixture end choice A.", "feedback": "Fixture feedback end A.", "pathway_kind": "transform", "effects": {"adaptability": 1}, "next": None},
                    {"key": "b", "label": "End B", "description": "Fixture end choice B.", "feedback": "Fixture feedback end B.", "pathway_kind": None, "effects": {}, "next": None},
                ],
                "display_order": 3,
            },
            {
                "occupation": "other-occupation",
                "key": "o1",
                "is_start": True,
                "title": "Other scenario",
                "narrative": "Fixture narrative for the other occupation.",
                "choices": [
                    {"key": "a", "label": "Other A", "description": "Fixture other choice A.", "feedback": "Fixture other feedback A.", "pathway_kind": "adapt", "next": None},
                    {"key": "b", "label": "Other B", "description": "Fixture other choice B.", "feedback": "Fixture other feedback B.", "pathway_kind": "discover", "next": None},
                ],
            },
        ]
    },
    "workforce_events.json": {
        "companies": [{"slug": "test-co", "name": "Test Co", "headquarters_country": "Kenya", "sector": "Testing", "website": "https://example.org"}],
        "events": [
            {
                "slug": "test-event",
                "company": "test-co",
                "title": "Fixture event",
                "event_date": "2025-01-01",
                "event_type": "ai_deployment",
                "summary": "Fixture workforce event summary.",
                "reported_figures": [{"figure": "1", "context": "Fixture figure context.", "verbatim": False}],
                "interpretation_note": "Fixture interpretation note.",
                "geographic_scope": "Kenya",
                "region": "kenya",
                "occupations": ["test-occupation"],
                "primary_source": "kenya-source",
            }
        ],
    },
}


def build_minimal_dataset() -> dict[str, Any]:
    return copy.deepcopy(_DATASET)
