"""Entry point loaded by the backend: ``SCENARIO_ENGINE_MODULE=app.services.scenario_engine.plugin``.

Exposes the four contract functions (see ``app/engine/contract.py``) plus
``ENGINE_VERSION`` and ``InvalidChoiceError``. It only re-exports: the logic
lives in the scenario engine, recommendation engine and report generator.
"""

from app.services.report_generator.generator import generate_report
from app.services.scenario_engine.engine import (
    ENGINE_VERSION,
    InvalidChoiceError,
    StepResult,
    apply_choice,
    present_scenario,
    start_state,
)

__all__ = [
    "ENGINE_VERSION",
    "InvalidChoiceError",
    "StepResult",
    "apply_choice",
    "generate_report",
    "present_scenario",
    "start_state",
]
