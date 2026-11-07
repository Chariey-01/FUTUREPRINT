"""Engine conformance checker: exercises an engine against the contract.

Pure Python: no Flask and no database. Given an :class:`EngineAdapter` and
one occupation's ``content`` dict (as built by the backend), it walks every
path the engine offers, depth first, and reports contract problems:

* outputs that fail the adapter's validation (shapes, ids, JSON);
* non-deterministic ``start_state``, ``apply_choice`` or ``generate_report``;
* ``apply_choice`` mutating its arguments;
* a presented choice that ``apply_choice`` then rejects;
* paths that do not complete within ``max_steps`` (loops).

Used by ``flask engine check`` and by the backend test suite. Person 3 can
run it against their engine before integration.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

from app.engine.adapter import EngineAdapter, EngineChoiceRejected, EngineError


@dataclass
class ConformanceReport:
    engine_id: str
    occupation_slug: str
    complete_paths: int = 0
    scenarios_presented: set[str] = field(default_factory=set)
    truncated: bool = False
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems

    def add(self, message: str) -> None:
        if message not in self.problems:
            self.problems.append(message)


def check_engine(
    adapter: EngineAdapter,
    content: dict[str, Any],
    *,
    max_steps: int = 50,
    max_paths: int = 2000,
) -> ConformanceReport:
    slug = content["occupation"]["slug"]
    report = ConformanceReport(engine_id=adapter.engine_id, occupation_slug=slug)
    scenarios = content["scenarios"]

    def label(scenario_id: str, choice_id: str | None = None) -> str:
        scenario = scenarios.get(scenario_id, {})
        text = scenario.get("key", scenario_id)
        if choice_id is not None:
            key = next((c["key"] for c in scenario.get("choices", []) if c["id"] == choice_id), choice_id)
            text += f"/{key}"
        return text

    try:
        first, second = adapter.start_state(), adapter.start_state()
    except EngineError as exc:
        report.add(f"start_state(): {exc}")
        return report
    if first != second:
        report.add("start_state() is not deterministic")

    stack: list[tuple[str, dict[str, Any], list[dict[str, Any]]]] = [(content["start_scenario_id"], first, [])]
    while stack:
        scenario_id, state, history = stack.pop()
        if len(history) >= max_steps:
            report.add(f"a path did not complete within {max_steps} steps (possible loop at {label(scenario_id)})")
            continue
        try:
            presented = adapter.present_scenario(content, scenario_id, state)
        except EngineError as exc:
            report.add(f"present_scenario({label(scenario_id)}): {exc}")
            continue
        report.scenarios_presented.add(scenario_id)

        for choice in presented["choices"]:
            choice_id = choice["id"]
            where = label(scenario_id, choice_id)
            content_copy, state_copy = copy.deepcopy(content), copy.deepcopy(state)
            try:
                adapter.module.apply_choice(content_copy, state_copy, scenario_id, choice_id)
            except Exception:  # reported below through the adapter
                pass
            if content_copy != content or state_copy != state:
                report.add(f"apply_choice({where}) mutates its arguments")
            try:
                result = adapter.apply_choice(content, state, scenario_id, choice_id)
                again = adapter.apply_choice(content, state, scenario_id, choice_id)
            except EngineChoiceRejected:
                report.add(f"present_scenario offered {where} but apply_choice rejects it")
                continue
            except EngineError as exc:
                report.add(f"apply_choice({where}): {exc}")
                continue
            if result != again:
                report.add(f"apply_choice({where}) is not deterministic")

            history_next = history + [
                {"step_index": len(history) + 1, "scenario_id": scenario_id, "choice_id": choice_id}
            ]
            if not result["completed"]:
                stack.append((result["next_scenario_id"], result["state"], history_next))
                continue

            report.complete_paths += 1
            try:
                final = adapter.generate_report(content, slug, history_next, result["state"])
                final_again = adapter.generate_report(content, slug, history_next, result["state"])
            except EngineError as exc:
                report.add(f"generate_report(after {where}): {exc}")
                continue
            if final != final_again:
                report.add("generate_report() is not deterministic")
            if report.complete_paths >= max_paths:
                report.truncated = True
                return report
    if report.complete_paths == 0 and not report.problems:
        report.add("no path reached completion")
    return report
