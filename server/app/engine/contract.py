"""Integration contract between the backend and the scenario engine.

The scenario engine is owned by another team member (Person 3). The backend
never reimplements its logic; it depends only on these four pure functions,
whose signatures are fixed by team agreement:

    start_state() -> dict
    apply_choice(content, state, current_scenario_id, choice_id) -> StepResult
    generate_report(content, occupation_slug, choices, state) -> dict
    present_scenario(content, scenario_id, state) -> dict

The functions must be pure and deterministic: no Flask, no database access,
no I/O, no randomness or clock reads, and no mutation of their arguments.
The backend loads content from PostgreSQL, passes it in as plain dicts,
validates what comes back, and persists the result inside a transaction
that holds a row lock on the session.

``content`` shape (all ids are UUID strings)::

    {
      "schema_version": 1,
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

``StepResult`` (dict, dataclass, NamedTuple or object with these fields)::

    {"state": dict, "next_scenario_id": str | None, "completed": bool,
     "feedback": str | None}

    completed=True  requires next_scenario_id=None
    completed=False requires next_scenario_id to be another scenario in content

``present_scenario`` must return at least (extra keys are passed through to
the API unchanged)::

    {"id": <the requested scenario_id>, "title": str, "narrative": str,
     "choices": [{"id": str, "label": str, ...}, ...]}   # ids from content

Optional module attributes (backward compatible; detected at start-up):

* ``ENGINE_VERSION: str``: recorded on sessions and report snapshots.
* ``InvalidChoiceError``: an ``Exception`` subclass. If ``apply_choice``
  raises it, the API answers ``422 choice_rejected`` (for example a choice
  the engine considers locked for the current state). Any other exception,
  or output that breaks this contract, is treated as an engine fault and
  answered with ``500 engine_error``. Nothing is persisted in either case.

Before calling ``apply_choice`` the backend has already verified, against
the database, that ``choice_id`` belongs to ``current_scenario_id`` and that
the session is active, so the engine receives only well-formed requests.
"""

from __future__ import annotations

from typing import Any, Protocol, TypedDict, runtime_checkable

REQUIRED_FUNCTIONS = ("start_state", "apply_choice", "generate_report", "present_scenario")

# Placeholder arguments used to check each function can be called with the
# agreed positional parameters (see adapter.check_signatures).
REQUIRED_ARITY = {"start_state": 0, "apply_choice": 4, "generate_report": 4, "present_scenario": 3}

CONTENT_SCHEMA_VERSION = 1
REFERENCE_ENGINE_MODULE = "app.engine.reference"


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
