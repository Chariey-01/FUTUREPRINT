"""A second, independent engine used only to prove the backend is pluggable.

TEST FIXTURE, not Person 3's engine and not product logic. It differs from
the reference stand-in on purpose (different state shape, a version, and a
locked choice) so the tests show the backend makes no assumptions beyond
the contract.

Rule: a choice whose key is "c" is locked. ``present_scenario`` hides it and
``apply_choice`` rejects it with ``InvalidChoiceError``.
"""

from __future__ import annotations

ENGINE_VERSION = "fixture-1"
LOCKED_KEYS = {"c"}


class InvalidChoiceError(Exception):
    pass


def start_state() -> dict:
    return {"score": 0, "path": []}


def _choice(content: dict, scenario_id: str, choice_id: str) -> dict:
    for choice in content["scenarios"][scenario_id]["choices"]:
        if choice["id"] == choice_id:
            if choice["key"] in LOCKED_KEYS:
                raise InvalidChoiceError("choice is locked")
            return choice
    raise InvalidChoiceError("choice not in scenario")


def apply_choice(content: dict, state: dict, current_scenario_id: str, choice_id: str) -> dict:
    choice = _choice(content, current_scenario_id, choice_id)
    next_id = choice["next_scenario_id"]
    return {
        "state": {"score": state["score"] + sum(choice["effects"].values()) + 1, "path": [*state["path"], choice["key"]]},
        "next_scenario_id": next_id,
        "completed": next_id is None,
        "feedback": f"fixture: {choice['label']}",
    }


def present_scenario(content: dict, scenario_id: str, state: dict) -> dict:
    scenario = content["scenarios"][scenario_id]
    return {
        "id": scenario_id,
        "title": scenario["title"],
        "narrative": scenario["narrative"],
        "choices": [
            {"id": c["id"], "label": c["label"], "description": c["description"]}
            for c in scenario["choices"]
            if c["key"] not in LOCKED_KEYS
        ],
        "fixture_score": state["score"],
    }


def generate_report(content: dict, occupation_slug: str, choices: list, state: dict) -> dict:
    return {"engine": "fixture", "occupation": occupation_slug, "steps": len(choices), "score": state["score"], "path": state["path"]}
