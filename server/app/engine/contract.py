"""Integration contract between the backend and the scenario engine.

The scenario engine is owned by another team member (Person 3). The backend
never reimplements its logic; it depends only on these four pure functions:

    start_state() -> dict
    apply_choice(content, state, current_scenario_id, choice_id) -> StepResult
    generate_report(content, occupation_slug, choices, state) -> dict
    present_scenario(content, scenario_id, state) -> dict

The functions must be pure: no Flask, no database access, no I/O. The backend
loads content from PostgreSQL, passes it in as plain dicts, validates what
comes back, and persists the result inside a locked transaction.

``content`` shape (all ids are UUID strings)::

    {
      "content_version": "2026.11.07+1a2b3c4d",
      "occupation": {"id": str, "slug": str, "name": str},
      "start_scenario_id": str,
      "scenarios": {
        "<scenario_id>": {
          "id": str, "key": str, "title": str, "narrative": str,
          "task": {"slug": str, "title": str, "exposure_level": str} | None,
          "choices": [
            {"id": str, "key": str, "label": str, "description": str,
             "feedback": str, "pathway_kind": "adapt"|"transform"|"discover"|None,
             "effects": {str: int}, "next_scenario_id": str | None}
          ]
        }
      },
      "pathways": [{"id", "slug", "kind", "title", "summary", "steps",
                    "target_roles", "skills": [{"slug", "name"}]}]
    }

``choices`` passed to ``generate_report`` is the ordered list of accepted
choices: ``[{"step_index": int, "scenario_id": str, "choice_id": str}]``.

``StepResult`` (dict or object with these attributes)::

    {"state": dict, "next_scenario_id": str | None, "completed": bool,
     "feedback": str | None}
"""

from __future__ import annotations

from typing import Any, Protocol, TypedDict, runtime_checkable

REQUIRED_FUNCTIONS = ("start_state", "apply_choice", "generate_report", "present_scenario")


class StepResult(TypedDict):
    state: dict[str, Any]
    next_scenario_id: str | None
    completed: bool
    feedback: str | None


@runtime_checkable
class ScenarioEngine(Protocol):
    def start_state(self) -> dict[str, Any]: ...

    def apply_choice(
        self, content: dict[str, Any], state: dict[str, Any], current_scenario_id: str, choice_id: str
    ) -> Any: ...

    def generate_report(
        self,
        content: dict[str, Any],
        occupation_slug: str,
        choices: list[dict[str, Any]],
        state: dict[str, Any],
    ) -> dict[str, Any]: ...

    def present_scenario(self, content: dict[str, Any], scenario_id: str, state: dict[str, Any]) -> Any: ...
