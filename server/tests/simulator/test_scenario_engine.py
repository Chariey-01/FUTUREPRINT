"""Unit tests for the scenario engine's state functions, on the real software-developer seed."""

from __future__ import annotations

import ast
import copy
from pathlib import Path

import pytest

from app.services.scenario_engine.engine import (
    InvalidChoiceError,
    apply_choice,
    dominant_pathway,
    present_scenario,
    rebuild_state,
    remaining_steps,
    start_state,
)
from tests.simulator.conftest import load_real_content

CONTENT = load_real_content("software-developer")
SERVICES = Path(__file__).resolve().parents[2] / "app" / "services"
ENGINE_PACKAGES = ("scenario_engine", "recommendation_engine", "report_generator")


def _state_with(adapt: int, transform: int, discover: int) -> dict:
    state = start_state()
    state["pathway_weights"] = {"adapt": adapt, "transform": transform, "discover": discover}
    return state


def test_start_state_shape():
    assert start_state() == {
        "pathway_weights": {"adapt": 0, "transform": 0, "discover": 0},
        "capabilities": [],
        "trade_offs": [],
        "history": [],
    }


def test_apply_choice_merges_signals_and_records_history():
    result = apply_choice(CONTENT, start_state(), "dev-1", "dev-1-a")

    assert result.next_scenario_id == "dev-2"
    assert result.completed is False
    assert result.feedback == CONTENT["scenarios"]["dev-1"]["choices"][0]["feedback"]
    assert result.state["pathway_weights"] == {"adapt": 1, "transform": 0, "discover": 0}
    assert result.state["capabilities"] == ["ai_fluency", "judgement"]  # by effect size, then name
    assert result.state["trade_offs"] == []
    assert result.state["history"] == [{"scenario_id": "dev-1", "choice_id": "dev-1-a"}]


def test_apply_choice_appends_tags_once_in_first_appearance_order():
    state = apply_choice(CONTENT, start_state(), "dev-1", "dev-1-a").state
    state = apply_choice(CONTENT, state, "dev-2", "dev-2-a").state

    assert state["capabilities"] == ["ai_fluency", "judgement", "technical_depth"]
    assert state["pathway_weights"] == {"adapt": 2, "transform": 0, "discover": 0}


def test_explicit_signals_take_precedence_over_kind_and_effects():
    content = copy.deepcopy(CONTENT)
    content["scenarios"]["dev-1"]["choices"][0].update(
        {"pathway_weights": {"transform": 2}, "capabilities": ["ai_tooling"], "trade_offs": ["speed_vs_quality"]}
    )

    state = apply_choice(content, start_state(), "dev-1", "dev-1-a").state

    assert state["pathway_weights"] == {"adapt": 0, "transform": 2, "discover": 0}
    assert state["capabilities"] == ["ai_tooling"]
    assert state["trade_offs"] == ["speed_vs_quality"]


def test_apply_choice_does_not_mutate_inputs():
    content, state = copy.deepcopy(CONTENT), start_state()
    apply_choice(content, state, "dev-1", "dev-1-b")
    assert content == CONTENT
    assert state == start_state()


def test_last_choice_completes_the_session():
    result = apply_choice(CONTENT, start_state(), "dev-3", "dev-3-c")
    assert result.next_scenario_id is None
    assert result.completed is True


def test_choice_from_another_scenario_is_rejected():
    with pytest.raises(InvalidChoiceError):
        apply_choice(CONTENT, start_state(), "dev-1", "dev-2-a")


def test_unknown_scenario_is_rejected():
    with pytest.raises(InvalidChoiceError):
        apply_choice(CONTENT, start_state(), "no-such-scenario", "dev-1-a")


@pytest.mark.parametrize(
    ("weights", "expected"),
    [
        ((0, 0, 0), "adapt"),
        ((1, 1, 1), "adapt"),
        ((0, 2, 2), "transform"),
        ((1, 0, 1), "adapt"),
        ((0, 0, 1), "discover"),
        ((1, 3, 2), "transform"),
    ],
)
def test_dominant_pathway_ties_resolve_adapt_transform_discover(weights, expected):
    assert dominant_pathway(_state_with(*weights)) == expected


def test_present_scenario_shape():
    presented = present_scenario(CONTENT, "dev-1", start_state())
    assert presented["id"] == "dev-1"
    assert presented["step_number"] == 1
    assert presented["total_steps"] == 3
    assert [c["id"] for c in presented["choices"]] == ["dev-1-a", "dev-1-b", "dev-1-c"]
    assert [c["pathway"] for c in presented["choices"]] == ["adapt", "transform", "discover"]
    assert set(presented["choices"][0]) == {"id", "label", "description", "pathway"}


def test_present_scenario_counts_steps_taken():
    state = apply_choice(CONTENT, start_state(), "dev-1", "dev-1-b").state
    state = apply_choice(CONTENT, state, "dev-2", "dev-2-b").state
    presented = present_scenario(CONTENT, "dev-3", state)
    assert presented["step_number"] == 3
    assert presented["total_steps"] == 3


def test_a_choice_that_leans_to_no_pathway_has_no_pathway_label():
    content = copy.deepcopy(CONTENT)
    content["scenarios"]["dev-1"]["choices"][0]["pathway_kind"] = None
    presented = present_scenario(content, "dev-1", start_state())
    assert [c["pathway"] for c in presented["choices"]] == [None, "transform", "discover"]


def test_total_steps_follows_the_longest_remaining_route():
    content = copy.deepcopy(CONTENT)
    content["scenarios"]["dev-1"]["choices"][2]["next_scenario_id"] = "dev-3"  # a shortcut past dev-2
    assert remaining_steps(content, "dev-1") == 3
    assert remaining_steps(content, "dev-2") == 2
    state = apply_choice(content, start_state(), "dev-1", "dev-1-c").state
    assert present_scenario(content, "dev-3", state)["total_steps"] == 2


def test_total_steps_rejects_a_cycle():
    content = copy.deepcopy(CONTENT)
    for choice in content["scenarios"]["dev-3"]["choices"]:
        choice["next_scenario_id"] = "dev-1"
    with pytest.raises(ValueError):
        remaining_steps(content, "dev-1")


@pytest.mark.parametrize(
    ("first", "second", "expected"),
    [("dev-1-a", "dev-2-a", "adapt"), ("dev-1-b", "dev-2-b", "transform"), ("dev-1-c", "dev-2-c", "discover")],
)
def test_present_scenario_picks_prompt_variant_by_dominant_pathway(first, second, expected):
    content = copy.deepcopy(CONTENT)
    variants = {kind: f"{kind} narrative" for kind in ("adapt", "transform", "discover")}
    content["scenarios"]["dev-3"]["prompt_variants"] = variants
    state = apply_choice(content, start_state(), "dev-1", first).state
    state = apply_choice(content, state, "dev-2", second).state
    assert present_scenario(content, "dev-3", state)["narrative"] == variants[expected]


def test_present_scenario_without_variants_uses_the_narrative():
    state = apply_choice(CONTENT, start_state(), "dev-1", "dev-1-a").state
    assert present_scenario(CONTENT, "dev-2", state)["narrative"] == CONTENT["scenarios"]["dev-2"]["narrative"]


def test_rebuild_state_replays_history_for_undo():
    state = apply_choice(CONTENT, start_state(), "dev-1", "dev-1-c").state
    state = apply_choice(CONTENT, state, "dev-2", "dev-2-b").state
    undone = rebuild_state(CONTENT, state["history"][:-1])
    assert undone == apply_choice(CONTENT, start_state(), "dev-1", "dev-1-c").state


@pytest.mark.parametrize("package", ENGINE_PACKAGES)
def test_engine_imports_only_the_standard_library_and_its_own_packages(package):
    allowed_app = tuple(f"app.services.{p}" for p in ENGINE_PACKAGES)
    banned = ("flask", "sqlalchemy", "requests", "random", "datetime", "time", "uuid", "secrets")
    for path in (SERVICES / package).glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""]
            else:
                continue
            for name in names:
                root = name.split(".")[0]
                assert root not in banned, f"{path.name} imports {name}"
                if root == "app":
                    assert name.startswith(allowed_app), f"{path.name} imports backend module {name}"
