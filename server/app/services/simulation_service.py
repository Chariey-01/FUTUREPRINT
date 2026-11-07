"""Scenario simulation: validate, apply and persist a user's choice.

Concurrency model: the session row is locked with ``SELECT ... FOR UPDATE``
for the whole transaction, so two simultaneous submissions for one session
run one after the other. The second sees the already-advanced session and is
rejected as a duplicate. Unique constraints on ``user_choices`` (one row per
step and per scenario) are a second line of defence.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError

from app import get_settings
from app.engine.adapter import EngineError
from app.errors import ApiError, Conflict, Unauthorized, ValidationFailed
from app.repositories import content_repository, session_repository
from app.services import session_service
from app.services.content_service import build_engine_content, get_engine

logger = logging.getLogger(__name__)


class EngineFailure(ApiError):
    status_code = 500
    code = "engine_error"
    message = "The scenario engine could not process this choice."


def submit_choice(session_id: uuid.UUID, choice_id: uuid.UUID) -> dict[str, Any]:
    settings = get_settings()
    engine = get_engine()
    try:
        session = session_repository.get_for_update(session_id)
        if session is None:
            raise Unauthorized("A valid session token is required.", code="invalid_token")
        session_service.ensure_not_expired(session)

        if session_repository.find_recorded_choice(session.id, choice_id) is not None:
            raise Conflict("This choice has already been submitted.", code="duplicate_choice")
        if session.status == "completed":
            raise Conflict("This simulation is already complete.", code="session_completed")

        current_id = session.current_scenario_id
        choice = content_repository.get_choice(choice_id)
        if choice is None or choice.scenario_id != current_id:
            raise ValidationFailed(
                "The choice does not belong to the current scenario.", code="invalid_choice"
            )

        content = build_engine_content(session.occupation, session.content_version)
        try:
            result = engine.apply_choice(content, session.state, str(current_id), str(choice_id))
        except EngineError as exc:
            logger.error("engine_rejected_choice", extra={"reason": str(exc)})
            raise EngineFailure() from exc

        now = session_service.utcnow()
        step_index = session.step_count + 1
        session_repository.add_choice(
            session_id=session.id,
            step_index=step_index,
            scenario_id=current_id,
            choice_id=choice_id,
            state_after=result["state"],
        )
        session.state = result["state"]
        session.step_count = step_index
        session.last_seen_at = now
        session.expires_at = max(session.expires_at, now + timedelta(hours=settings.session_ttl_hours))
        if result["completed"]:
            session.status = "completed"
            session.current_scenario_id = None
            session.completed_at = now
        else:
            session.current_scenario_id = uuid.UUID(result["next_scenario_id"])
        session_repository.commit()
    except IntegrityError as exc:
        session_repository.rollback()
        raise Conflict("This choice has already been submitted.", code="duplicate_choice") from exc
    except Exception:
        session_repository.rollback()
        raise

    return {
        "accepted_choice": {
            "id": str(choice_id),
            "label": choice.label,
            "step_index": step_index,
            "feedback": result["feedback"] or choice.feedback,
        },
        "completed": result["completed"],
        "session": session_service.build_view(session),
    }
