import types

import pytest

from app.config import ConfigError
from app.engine import reference
from app.engine.adapter import EngineAdapter, EngineError, load_engine

CONTENT = {
    "scenarios": {
        "s1": {"id": "s1", "title": "One", "narrative": "n", "task": None,
               "choices": [{"id": "c1", "label": "L", "description": "d", "feedback": "f",
                            "pathway_kind": "adapt", "effects": {"ai_fluency": 1}, "next_scenario_id": "s2"}]},
        "s2": {"id": "s2", "title": "Two", "narrative": "n", "task": None,
               "choices": [{"id": "c2", "label": "L", "description": "d", "feedback": "f",
                            "pathway_kind": None, "effects": {}, "next_scenario_id": None}]},
    },
    "pathways": [],
}


def module_with(**overrides):
    module = types.ModuleType("fake_engine")
    for name in ("start_state", "apply_choice", "generate_report", "present_scenario"):
        setattr(module, name, overrides.get(name, getattr(reference, name)))
    return module


def test_reference_engine_only_when_allowed():
    engine = load_engine(None, allow_reference=True)
    assert engine.is_reference and engine.name == "app.engine.reference"
    assert engine.engine_id == "app.engine.reference"
    with pytest.raises(ConfigError, match="development stand-in"):
        load_engine(None)
    with pytest.raises(ConfigError, match="development stand-in"):
        load_engine("app.engine.reference", allow_reference=False)


def test_missing_module_or_functions_fail_fast(monkeypatch):
    with pytest.raises(ConfigError):
        load_engine("not.a.real.module")
    incomplete = types.ModuleType("incomplete_engine")
    incomplete.start_state = reference.start_state
    monkeypatch.setitem(__import__("sys").modules, "incomplete_engine", incomplete)
    with pytest.raises(ConfigError, match="missing function apply_choice"):
        load_engine("incomplete_engine")


def test_external_module_is_loaded(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "teammate_engine", module_with())
    engine = load_engine("teammate_engine")
    assert engine.is_reference is False


def test_reference_engine_step_and_report():
    engine = EngineAdapter(reference, is_reference=True)
    state = engine.start_state()
    step = engine.apply_choice(CONTENT, state, "s1", "c1")
    assert step["next_scenario_id"] == "s2" and not step["completed"]
    assert step["state"]["traits"] == {"ai_fluency": 1}
    assert state["step"] == 0  # input not mutated
    final = engine.apply_choice(CONTENT, step["state"], "s2", "c2")
    assert final["completed"] and final["next_scenario_id"] is None


@pytest.mark.parametrize(
    "bad_result, message",
    [
        ({"state": {}, "completed": True, "next_scenario_id": "s2"}, "completed=True"),
        ({"state": {}, "completed": False, "next_scenario_id": None}, "without a next_scenario_id"),
        ({"state": {}, "completed": False, "next_scenario_id": "zzz"}, "unknown next_scenario_id"),
        ({"state": {}, "completed": False, "next_scenario_id": "s1"}, "current scenario"),
        ({"completed": False}, "invalid StepResult"),
        ({"state": {"x": object()}, "completed": True, "next_scenario_id": None}, "JSON"),
    ],
)
def test_adapter_rejects_contract_violations(bad_result, message):
    engine = EngineAdapter(module_with(apply_choice=lambda *a: bad_result), is_reference=False)
    with pytest.raises(EngineError, match=message):
        engine.apply_choice(CONTENT, {}, "s1", "c1")


def test_adapter_wraps_engine_exceptions_and_accepts_objects():
    def boom(*args):
        raise KeyError("oops")

    with pytest.raises(EngineError, match="KeyError"):
        EngineAdapter(module_with(apply_choice=boom), is_reference=False).apply_choice(CONTENT, {}, "s1", "c1")

    result_obj = types.SimpleNamespace(state={"a": 1}, completed=True, next_scenario_id=None, feedback="ok")
    step = EngineAdapter(module_with(apply_choice=lambda *a: result_obj), is_reference=False).apply_choice(CONTENT, {}, "s1", "c1")
    assert step["state"] == {"a": 1} and step["feedback"] == "ok"


def test_engine_cannot_mutate_backend_content():
    def mutating(content, state, sid, cid):
        content["scenarios"].clear()
        return {"state": state, "completed": True, "next_scenario_id": None}

    content = {"scenarios": dict(CONTENT["scenarios"]), "pathways": []}
    EngineAdapter(module_with(apply_choice=mutating), is_reference=False).apply_choice(content, {}, "s1", "c1")
    assert set(content["scenarios"]) == {"s1", "s2"}
