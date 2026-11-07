"""FUTUREPRINT scenario engine: turns choices into session state.

Pure functions over plain data. No Flask, no SQLAlchemy, no I/O, no clock and
no randomness, so identical choices always produce identical state.

Each choice writes signals into the state instead of leading to its own
ending (PRD section 7):

* ``pathway_weights``: integer weights added to Adapt, Transform and Discover;
* ``capabilities`` and ``trade_offs``: tags appended in order of first
  appearance, without duplicates.

The report is computed from these accumulated signals, so the graph can
converge (for example 5 scenarios and 15 choices per occupation) while every path still
produces its own report.

Content written before signals existed (backend ``content`` schema version 1)
is read through :func:`choice_signals`: a choice's ``pathway_kind`` becomes a
weight of 1 and its positive ``effects`` become capability tags.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any

ENGINE_VERSION = "1.0.0"

# Fixed tie-break order (PRD section 13). ``max`` keeps the first of equal
# values, so iterating in this order resolves ties Adapt, Transform, Discover.
PATHWAY_ORDER = ("adapt", "transform", "discover")


class InvalidChoiceError(ValueError):
    """The choice does not belong to the current scenario."""


@dataclass(frozen=True)
class StepResult:
    next_scenario_id: str | None
    state: dict[str, Any]
    completed: bool = False
    feedback: str | None = None


def start_state() -> dict[str, Any]:
    return {
        "pathway_weights": {kind: 0 for kind in PATHWAY_ORDER},
        "capabilities": [],
        "trade_offs": [],
        "history": [],
    }


def dominant_pathway(state: dict[str, Any]) -> str:
    weights = state["pathway_weights"]
    return max(PATHWAY_ORDER, key=lambda kind: weights.get(kind, 0))


def find_choice(content: dict[str, Any], scenario_id: str, choice_id: str) -> dict[str, Any]:
    scenario = content["scenarios"].get(scenario_id)
    if scenario is None:
        raise InvalidChoiceError(f"unknown scenario {scenario_id!r}")
    for choice in scenario["choices"]:
        if choice["id"] == choice_id:
            return choice
    raise InvalidChoiceError(f"choice {choice_id!r} does not belong to scenario {scenario_id!r}")


def choice_signals(choice: dict[str, Any]) -> dict[str, Any]:
    """The signals a choice writes into state, in a single normalised shape."""
    if "pathway_weights" in choice:
        weights = {kind: int(choice["pathway_weights"].get(kind, 0)) for kind in PATHWAY_ORDER}
    else:
        kind = choice.get("pathway_kind")
        weights = {k: (1 if k == kind else 0) for k in PATHWAY_ORDER}
    if "capabilities" in choice:
        capabilities = list(choice["capabilities"])
    else:
        effects = choice.get("effects") or {}
        positive = [tag for tag, delta in effects.items() if int(delta) > 0]
        capabilities = sorted(positive, key=lambda tag: (-int(effects[tag]), tag))
    return {
        "pathway_weights": weights,
        "capabilities": capabilities,
        "trade_offs": list(choice.get("trade_offs", [])),
    }


def _append_unique(tags: list[str], new_tags: list[str]) -> None:
    for tag in new_tags:
        if tag not in tags:
            tags.append(tag)


def _merge_signals(state: dict[str, Any], signals: dict[str, Any]) -> None:
    weights = state["pathway_weights"]
    for kind, delta in signals["pathway_weights"].items():
        weights[kind] = weights.get(kind, 0) + delta
    _append_unique(state["capabilities"], signals["capabilities"])
    _append_unique(state["trade_offs"], signals["trade_offs"])


def apply_choice(
    content: dict[str, Any], state: dict[str, Any], current_scenario_id: str, choice_id: str
) -> StepResult:
    choice = find_choice(content, current_scenario_id, choice_id)
    new_state = copy.deepcopy(state)
    _merge_signals(new_state, choice_signals(choice))
    new_state["history"].append({"scenario_id": current_scenario_id, "choice_id": choice_id})
    next_id = choice.get("next_scenario_id")
    return StepResult(
        next_scenario_id=next_id,
        state=new_state,
        completed=next_id is None,
        feedback=choice.get("feedback"),
    )


def rebuild_state(content: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    """Replay a history from scratch. Used for undo (FR-16) and report building."""
    state = start_state()
    for step in history:
        state = apply_choice(content, state, step["scenario_id"], step["choice_id"]).state
    return state


def scenario_prompt(content: dict[str, Any], scenario_id: str, state: dict[str, Any]) -> str:
    """The narrative shown for a scenario, chosen by the dominant pathway when it has variants."""
    scenario = content["scenarios"][scenario_id]
    variants = scenario.get("prompt_variants") or {}
    if variants and any(state["pathway_weights"].values()):
        return variants.get(dominant_pathway(state), scenario["narrative"])
    return scenario["narrative"]


def choice_pathway(choice: dict[str, Any]) -> str | None:
    """The pathway a choice leans towards most (same tie-break), or None when it leans to none."""
    weights = choice_signals(choice)["pathway_weights"]
    if not any(weight > 0 for weight in weights.values()):
        return None
    return dominant_pathway({"pathway_weights": weights})


def remaining_steps(content: dict[str, Any], scenario_id: str) -> int:
    """Decisions left on the longest route from this scenario to the end, this one included."""
    longest, limit = {}, len(content["scenarios"])

    def walk(sid: str, depth: int) -> int:
        if depth > limit:
            raise ValueError("scenario graph contains a cycle")
        if sid not in longest:
            nexts = [c["next_scenario_id"] for c in content["scenarios"][sid]["choices"] if c.get("next_scenario_id")]
            longest[sid] = 1 + max((walk(n, depth + 1) for n in nexts), default=0)
        return longest[sid]

    return walk(scenario_id, 0)


def present_scenario(content: dict[str, Any], scenario_id: str, state: dict[str, Any]) -> dict[str, Any]:
    scenario = content["scenarios"][scenario_id]
    steps_taken = len(state["history"])
    return {
        "id": scenario["id"],
        "key": scenario.get("key"),
        "title": scenario["title"],
        "narrative": scenario_prompt(content, scenario_id, state),
        "task": scenario.get("task"),
        "step_number": steps_taken + 1,
        "total_steps": steps_taken + remaining_steps(content, scenario_id),
        "choices": [
            {"id": c["id"], "label": c["label"], "description": c.get("description", ""), "pathway": choice_pathway(c)}
            for c in scenario["choices"]
        ],
    }
