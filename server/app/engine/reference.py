"""Reference engine: a minimal stand-in that satisfies the contract.

IMPORTANT: this is NOT the FUTUREPRINT scenario engine. The real engine is
owned by Person 3 and is plugged in with ``SCENARIO_ENGINE_MODULE``. This
module exists so the API can be exercised end-to-end before that engine is
integrated. It contains no scoring model of its own: it only follows the
transitions and effects declared in the curated seed data
(``choice.next_scenario_id`` and ``choice.effects``) and tallies which
pathway kind each choice leans towards.
"""

from __future__ import annotations

import copy
from typing import Any

PATHWAY_ORDER = ("adapt", "transform", "discover")


def start_state() -> dict[str, Any]:
    return {
        "step": 0,
        "pathway_affinity": {kind: 0 for kind in PATHWAY_ORDER},
        "traits": {},
        "visited_scenarios": [],
    }


def _find_choice(content: dict[str, Any], scenario_id: str, choice_id: str) -> dict[str, Any]:
    scenario = content["scenarios"].get(scenario_id)
    if scenario is None:
        raise ValueError("unknown scenario")
    for choice in scenario["choices"]:
        if choice["id"] == choice_id:
            return choice
    raise ValueError("choice does not belong to scenario")


def apply_choice(
    content: dict[str, Any], state: dict[str, Any], current_scenario_id: str, choice_id: str
) -> dict[str, Any]:
    choice = _find_choice(content, current_scenario_id, choice_id)
    new_state = copy.deepcopy(state)
    new_state["step"] = int(new_state.get("step", 0)) + 1
    affinity = new_state.setdefault("pathway_affinity", {kind: 0 for kind in PATHWAY_ORDER})
    if choice.get("pathway_kind"):
        affinity[choice["pathway_kind"]] = affinity.get(choice["pathway_kind"], 0) + 1
    traits = new_state.setdefault("traits", {})
    for trait, delta in (choice.get("effects") or {}).items():
        traits[trait] = traits.get(trait, 0) + int(delta)
    new_state.setdefault("visited_scenarios", []).append(current_scenario_id)
    next_id = choice.get("next_scenario_id")
    return {
        "state": new_state,
        "next_scenario_id": next_id,
        "completed": next_id is None,
        "feedback": choice.get("feedback"),
    }


def present_scenario(content: dict[str, Any], scenario_id: str, state: dict[str, Any]) -> dict[str, Any]:
    scenario = content["scenarios"][scenario_id]
    return {
        "id": scenario["id"],
        "title": scenario["title"],
        "narrative": scenario["narrative"],
        "task": scenario.get("task"),
        "step_number": int(state.get("step", 0)) + 1,
        "choices": [
            {"id": c["id"], "label": c["label"], "description": c["description"]} for c in scenario["choices"]
        ],
    }


def generate_report(
    content: dict[str, Any], occupation_slug: str, choices: list[dict[str, Any]], state: dict[str, Any]
) -> dict[str, Any]:
    affinity = state.get("pathway_affinity", {})
    ranked = sorted(PATHWAY_ORDER, key=lambda k: (-int(affinity.get(k, 0)), PATHWAY_ORDER.index(k)))
    pathways_by_kind: dict[str, list[dict[str, Any]]] = {}
    for pathway in content.get("pathways", []):
        pathways_by_kind.setdefault(pathway["kind"], []).append(pathway)
    recommended = [p for kind in ranked for p in pathways_by_kind.get(kind, [])]
    traits = state.get("traits", {})
    return {
        "engine": "reference",
        "occupation_slug": occupation_slug,
        "steps_completed": len(choices),
        "pathway_affinity": {k: int(affinity.get(k, 0)) for k in PATHWAY_ORDER},
        "leading_pathway_kind": ranked[0] if any(affinity.values()) else None,
        "recommended_pathways": [
            {"slug": p["slug"], "kind": p["kind"], "title": p["title"], "summary": p["summary"]}
            for p in recommended
        ],
        "strengths_developed": sorted((t for t, v in traits.items() if v > 0), key=lambda t: (-traits[t], t)),
    }
