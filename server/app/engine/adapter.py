"""Adapter that loads the configured scenario engine and guards its outputs.

The adapter is the only place the backend touches engine code. It:

* imports the engine module named by ``SCENARIO_ENGINE_MODULE`` (or the
  in-repo reference implementation when unset) and checks the contract;
* deep-copies inputs so an engine cannot mutate backend data;
* validates outputs (shape, JSON-serialisable, referential sanity) before
  anything is persisted; and
* converts engine exceptions into :class:`EngineError`.
"""

from __future__ import annotations

import copy
import dataclasses
import importlib
import json
import logging
from types import ModuleType
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from app.config import ConfigError
from app.engine.contract import REQUIRED_FUNCTIONS, StepResult

logger = logging.getLogger(__name__)


class EngineError(RuntimeError):
    """The scenario engine failed or returned output that breaks the contract."""


class _StepResultModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    state: dict[str, Any]
    next_scenario_id: str | None = None
    completed: bool
    feedback: str | None = None


def _to_plain(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    if hasattr(value, "_asdict"):
        return value._asdict()
    if not isinstance(value, dict) and hasattr(value, "__dict__"):
        return dict(vars(value))
    return value


def _ensure_json(value: Any, what: str) -> Any:
    try:
        return json.loads(json.dumps(value))
    except (TypeError, ValueError) as exc:
        raise EngineError(f"{what} is not JSON-serialisable") from exc


class EngineAdapter:
    def __init__(self, module: ModuleType, *, is_reference: bool) -> None:
        self._module = module
        self.name = module.__name__
        self.is_reference = is_reference

    def _call(self, func: str, *args: Any) -> Any:
        try:
            return getattr(self._module, func)(*copy.deepcopy(args))
        except EngineError:
            raise
        except Exception as exc:  # engine bugs must not leak to clients
            logger.exception("engine_call_failed", extra={"engine": self.name, "function": func})
            raise EngineError(f"engine.{func} raised {type(exc).__name__}") from exc

    def start_state(self) -> dict[str, Any]:
        state = _to_plain(self._call("start_state"))
        if not isinstance(state, dict):
            raise EngineError("start_state must return a dict")
        return _ensure_json(state, "start_state result")

    def apply_choice(
        self, content: dict[str, Any], state: dict[str, Any], current_scenario_id: str, choice_id: str
    ) -> StepResult:
        raw = _to_plain(self._call("apply_choice", content, state, current_scenario_id, choice_id))
        try:
            result = _StepResultModel.model_validate(raw)
        except ValidationError as exc:
            raise EngineError(f"apply_choice returned an invalid StepResult: {exc.error_count()} error(s)") from exc
        if result.completed and result.next_scenario_id is not None:
            raise EngineError("apply_choice returned completed=True with a next_scenario_id")
        if not result.completed:
            if result.next_scenario_id is None:
                raise EngineError("apply_choice returned completed=False without a next_scenario_id")
            if result.next_scenario_id not in content["scenarios"]:
                raise EngineError("apply_choice returned an unknown next_scenario_id")
            if result.next_scenario_id == current_scenario_id:
                raise EngineError("apply_choice returned the current scenario as the next scenario")
        return StepResult(
            state=_ensure_json(result.state, "apply_choice state"),
            next_scenario_id=result.next_scenario_id,
            completed=result.completed,
            feedback=result.feedback,
        )

    def present_scenario(self, content: dict[str, Any], scenario_id: str, state: dict[str, Any]) -> dict[str, Any]:
        presented = _to_plain(self._call("present_scenario", content, scenario_id, state))
        if not isinstance(presented, dict):
            raise EngineError("present_scenario must return a dict")
        return _ensure_json(presented, "present_scenario result")

    def generate_report(
        self,
        content: dict[str, Any],
        occupation_slug: str,
        choices: list[dict[str, Any]],
        state: dict[str, Any],
    ) -> dict[str, Any]:
        report = _to_plain(self._call("generate_report", content, occupation_slug, choices, state))
        if not isinstance(report, dict):
            raise EngineError("generate_report must return a dict")
        return _ensure_json(report, "generate_report result")


def load_engine(module_path: str | None) -> EngineAdapter:
    """Load and contract-check the engine module. Fails fast at start-up."""
    if module_path:
        try:
            module = importlib.import_module(module_path)
        except ImportError as exc:
            raise ConfigError(f"SCENARIO_ENGINE_MODULE '{module_path}' could not be imported: {exc}") from exc
        is_reference = False
    else:
        from app.engine import reference as module

        is_reference = True
    missing = [name for name in REQUIRED_FUNCTIONS if not callable(getattr(module, name, None))]
    if missing:
        raise ConfigError(f"Scenario engine '{module.__name__}' is missing: {', '.join(missing)}")
    return EngineAdapter(module, is_reference=is_reference)
