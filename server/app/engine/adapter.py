"""Adapter that loads the configured scenario engine and guards its outputs.

The adapter is the only place the backend touches engine code. It:

* imports the engine module named by ``SCENARIO_ENGINE_MODULE`` (or, when
  explicitly allowed, the in-repo reference stand-in) and checks the
  contract at start-up: functions present, signatures compatible, and a
  smoke call of ``start_state()``;
* refuses to run the reference stand-in unless it is allowed (by default it
  is allowed in development/testing and refused in production);
* deep-copies inputs so an engine cannot mutate backend data;
* validates outputs (shape, JSON-serialisable, referential sanity) before
  anything is persisted; and
* converts engine exceptions into :class:`EngineError`, or into
  :class:`EngineChoiceRejected` when the engine raises its own
  ``InvalidChoiceError``.
"""

from __future__ import annotations

import copy
import dataclasses
import importlib
import inspect
import json
import logging
from types import ModuleType
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import ConfigError
from app.engine.contract import REFERENCE_ENGINE_MODULE, REQUIRED_ARITY, REQUIRED_FUNCTIONS, StepResult

logger = logging.getLogger(__name__)


class EngineError(RuntimeError):
    """The scenario engine failed or returned output that breaks the contract."""


class EngineChoiceRejected(EngineError):
    """The engine deliberately rejected a choice by raising its InvalidChoiceError."""


class _StepResultModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    state: dict[str, Any]
    next_scenario_id: str | None = None
    completed: bool
    feedback: str | None = None


class _PresentedChoice(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    label: str


class _PresentedScenario(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    title: str
    narrative: str
    choices: list[_PresentedChoice] = Field(min_length=1)


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
    def __init__(self, module: ModuleType, *, is_reference: bool | None = None) -> None:
        self._module = module
        self.name = module.__name__
        self.is_reference = module.__name__ == REFERENCE_ENGINE_MODULE if is_reference is None else is_reference
        version = getattr(module, "ENGINE_VERSION", None)
        self.version = str(version) if version is not None else None
        rejected = getattr(module, "InvalidChoiceError", None)
        self._choice_errors: tuple[type[BaseException], ...] = (
            (rejected,) if isinstance(rejected, type) and issubclass(rejected, Exception) else ()
        )

    @property
    def module(self) -> ModuleType:
        return self._module

    @property
    def engine_id(self) -> str:
        """Identity stored on sessions: state from one engine is never fed to another."""
        return f"{self.name}@{self.version}" if self.version else self.name

    def describe(self) -> dict[str, Any]:
        return {"name": self.name, "version": self.version, "is_reference": self.is_reference}

    def _call(self, func: str, *args: Any) -> Any:
        try:
            return getattr(self._module, func)(*copy.deepcopy(args))
        except EngineError:
            raise
        except Exception as exc:  # engine bugs must not leak to clients
            if func == "apply_choice" and isinstance(exc, self._choice_errors):
                logger.info("engine_rejected_choice", extra={"engine": self.engine_id, "reason": str(exc)[:200]})
                raise EngineChoiceRejected(str(exc)) from exc
            logger.exception("engine_call_failed", extra={"engine": self.engine_id, "function": func})
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
        presented = _ensure_json(_to_plain(self._call("present_scenario", content, scenario_id, state)), "present_scenario result")
        if not isinstance(presented, dict):
            raise EngineError("present_scenario must return a dict")
        try:
            parsed = _PresentedScenario.model_validate(presented)
        except ValidationError as exc:
            raise EngineError(f"present_scenario returned an invalid scenario: {exc.error_count()} error(s)") from exc
        if parsed.id != scenario_id:
            raise EngineError("present_scenario returned a different scenario id")
        known = {c["id"] for c in content["scenarios"][scenario_id]["choices"]}
        if any(choice.id not in known for choice in parsed.choices):
            raise EngineError("present_scenario returned a choice that is not in the scenario's content")
        return presented

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


def check_signatures(module: ModuleType) -> list[str]:
    """Return problems with the module's public contract (empty list if compatible)."""
    problems = []
    for name in REQUIRED_FUNCTIONS:
        func = getattr(module, name, None)
        if not callable(func):
            problems.append(f"missing function {name}()")
            continue
        try:
            inspect.signature(func).bind(*([None] * REQUIRED_ARITY[name]))
        except TypeError:
            problems.append(f"{name}() cannot be called with {REQUIRED_ARITY[name]} positional argument(s)")
        except ValueError:  # builtins without introspectable signatures
            continue
    rejected = getattr(module, "InvalidChoiceError", None)
    if rejected is not None and not (isinstance(rejected, type) and issubclass(rejected, Exception)):
        problems.append("InvalidChoiceError must be an Exception subclass")
    version = getattr(module, "ENGINE_VERSION", None)
    if version is not None and not isinstance(version, str):
        problems.append("ENGINE_VERSION must be a string")
    return problems


def load_engine(module_path: str | None, *, allow_reference: bool = False) -> EngineAdapter:
    """Load and contract-check the engine module. Fails fast at start-up."""
    path = module_path or REFERENCE_ENGINE_MODULE
    if path == REFERENCE_ENGINE_MODULE and not allow_reference:
        raise ConfigError(
            "The reference scenario engine is a development stand-in and is not allowed in this "
            "environment. Set SCENARIO_ENGINE_MODULE to the real engine, or set "
            "ALLOW_REFERENCE_ENGINE=true to override deliberately."
        )
    try:
        module = importlib.import_module(path)
    except Exception as exc:  # ImportError, SyntaxError or errors raised at import time
        raise ConfigError(f"Scenario engine '{path}' could not be imported: {type(exc).__name__}: {exc}") from exc

    problems = check_signatures(module)
    if problems:
        raise ConfigError(f"Scenario engine '{path}' is incompatible with the contract: " + "; ".join(problems))

    adapter = EngineAdapter(module)
    try:
        adapter.start_state()
    except EngineError as exc:
        raise ConfigError(f"Scenario engine '{path}' failed its start-up check: {exc}") from exc

    if adapter.is_reference:
        logger.warning(
            "engine_reference_in_use",
            extra={"engine": adapter.engine_id, "hint": "development stand-in; set SCENARIO_ENGINE_MODULE"},
        )
    else:
        logger.info("engine_loaded", extra={"engine": adapter.engine_id})
    return adapter
