"""Fixtures for the pure engine tests: no Flask app and no database.

``_clean_database`` overrides the autouse fixture in ``tests/conftest.py``
so these tests run without ``TEST_DATABASE_URL``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.services.report_generator.generator import generate_report
from app.services.scenario_engine.engine import apply_choice, start_state

REAL_SEED_DIR = Path(__file__).resolve().parents[2] / "seed_data"


@pytest.fixture(autouse=True)
def _clean_database():
    yield


def load_real_content(occupation_slug: str) -> dict[str, Any]:
    """Build backend-shaped ``content`` (schema version 1) from ``seed_data`` without a database.

    Scenario and choice ids are the seed keys instead of UUIDs; the engine only
    compares ids, so the shape is otherwise what ``build_engine_content`` sends.
    """

    def read(name: str) -> Any:
        return json.loads((REAL_SEED_DIR / name).read_text(encoding="utf-8"))

    occupation = next(o for o in read("occupations.json")["occupations"] if o["slug"] == occupation_slug)
    scenarios = [s for s in read("scenarios.json")["scenarios"] if s["occupation"] == occupation_slug]
    pathways = [p for p in read("pathways.json")["pathways"] if p["occupation"] == occupation_slug]
    skills = {s["slug"]: s["name"] for s in read("skills.json")["skills"]}
    return {
        "schema_version": 1,
        "content_version": read("manifest.json")["dataset_version"],
        "occupation": {"id": occupation_slug, "slug": occupation_slug, "name": occupation["name"]},
        "start_scenario_id": next(s["key"] for s in scenarios if s.get("is_start")),
        "scenarios": {
            s["key"]: {
                "id": s["key"], "key": s["key"], "title": s["title"], "narrative": s["narrative"], "task": None,
                "choices": [
                    {"id": f"{s['key']}-{c['key']}", "key": c["key"], "label": c["label"],
                     "description": c["description"], "feedback": c["feedback"], "pathway_kind": c["pathway_kind"],
                     "effects": c["effects"], "next_scenario_id": c["next"]}
                    for c in s["choices"]
                ],
            }
            for s in scenarios
        },
        "pathways": [
            {"id": p["slug"], "slug": p["slug"], "kind": p["kind"], "title": p["title"], "summary": p["summary"],
             "steps": p["steps"], "target_roles": p.get("target_roles", []),
             "skills": [{"slug": sk, "name": skills.get(sk, sk)} for sk in p.get("skills", [])]}
            for p in pathways
        ],
    }


def load_research_content(occupation_slug: str) -> dict[str, Any]:
    """``load_real_content`` plus the optional fields the engine reads when present.

    Adds the occupation's tasks with their skills, each pathway's evidence ids and the
    evidence records, all taken from ``seed_data``, as the backend will send them once
    ``content`` carries these fields (docs/engine-integration.md section 9).
    """

    def read(name: str) -> Any:
        return json.loads((REAL_SEED_DIR / name).read_text(encoding="utf-8"))

    content = load_real_content(occupation_slug)
    skills = {s["slug"]: s["name"] for s in read("skills.json")["skills"]}
    tasks = [t for t in read("tasks.json")["tasks"] if t["occupation"] == occupation_slug]
    content["occupation"]["tasks"] = [
        {"slug": t["slug"], "title": t["title"], "skills": [{"slug": s, "name": skills.get(s, s)} for s in t["skills"]]}
        for t in tasks
    ]
    pathways = {p["slug"]: p for p in read("pathways.json")["pathways"]}
    for pathway in content["pathways"]:
        pathway["evidence_ids"] = [e["source"] for e in pathways[pathway["slug"]].get("evidence", [])]
    content["evidence"] = {
        s["key"]: {
            "id": s["key"],
            "title": s["title"],
            "publisher": s["organisation"],
            "year": int(s["publication_date"][:4]) if s.get("publication_date") else None,
            "url": s["url"],
            "statement": s["findings"][0]["statement"] if s.get("findings") else s["summary"],
        }
        for s in read("evidence_sources.json")["sources"]
    }
    return content


def all_paths(content: dict[str, Any]) -> list[tuple[str, ...]]:
    """Every sequence of choice ids from the start scenario to completion."""
    paths: list[tuple[str, ...]] = []

    def walk(scenario_id: str | None, path: tuple[str, ...]) -> None:
        if scenario_id is None:
            paths.append(path)
            return
        for choice in content["scenarios"][scenario_id]["choices"]:
            walk(choice["next_scenario_id"], path + (choice["id"],))

    walk(content["start_scenario_id"], ())
    return paths


def run(content: dict[str, Any], path: tuple[str, ...]) -> dict[str, Any]:
    """Play a path through the engine and return its report."""
    state, scenario_id, choices = start_state(), content["start_scenario_id"], []
    for index, choice_id in enumerate(path, start=1):
        choices.append({"step_index": index, "scenario_id": scenario_id, "choice_id": choice_id})
        result = apply_choice(content, state, scenario_id, choice_id)
        state, scenario_id = result.state, result.next_scenario_id
    assert scenario_id is None, "path did not complete"
    return generate_report(content, content["occupation"]["slug"], choices, state)


def final_state(content: dict[str, Any], path: tuple[str, ...]) -> dict[str, Any]:
    state, scenario_id = start_state(), content["start_scenario_id"]
    for choice_id in path:
        result = apply_choice(content, state, scenario_id, choice_id)
        state, scenario_id = result.state, result.next_scenario_id
    return state

