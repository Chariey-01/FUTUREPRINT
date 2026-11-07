"""Anonymous session lifecycle: creation, authentication and state views."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app import get_settings
from app.errors import Conflict, NotFound, ServiceUnavailable, Unauthorized
from app.models import AnonymousSession
from app.repositories import content_repository, report_repository, session_repository
from app.security import generate_session_token, is_well_formed_session_token, sha256_hex
from app.services import serializers as s
from app.services.content_service import build_engine_content, get_engine


def utcnow() -> datetime:
    return datetime.now(UTC)


def create_session(occupation_slug: str) -> tuple[str, dict[str, Any]]:
    """Create a session and return ``(raw_token, session_view)``.

    The raw token is returned exactly once; only its hash is persisted.
    """
    settings = get_settings()
    version = content_repository.get_active_content_version()
    if version is None:
        raise ServiceUnavailable("Content has not been loaded yet.", code="content_not_loaded")
    occupation = content_repository.get_occupation_by_slug(occupation_slug)
    if occupation is None:
        raise NotFound("Occupation not found.", code="occupation_not_found")
    start = content_repository.get_start_scenario(occupation.id)
    if start is None:
        raise ServiceUnavailable("No simulation is available for this occupation.", code="simulation_unavailable")

    engine = get_engine()
    raw_token = generate_session_token()
    try:
        session = session_repository.create(
            token_hash=sha256_hex(raw_token),
            occupation_id=occupation.id,
            content_version_id=version.id,
            current_scenario_id=start.id,
            state=engine.start_state(),
            engine_id=engine.engine_id,
            expires_at=utcnow() + timedelta(hours=settings.session_ttl_hours),
        )
        session_repository.commit()
    except Exception:
        session_repository.rollback()
        raise
    return raw_token, build_view(session)


def authenticate(raw_token: str | None) -> AnonymousSession:
    """Resolve a bearer token to an active, unexpired session."""
    if not raw_token or not is_well_formed_session_token(raw_token):
        raise Unauthorized("A valid session token is required.", code="invalid_token")
    session = session_repository.get_by_token_hash(sha256_hex(raw_token))
    if session is None:
        raise Unauthorized("A valid session token is required.", code="invalid_token")
    ensure_not_expired(session)
    return session


def ensure_not_expired(session: AnonymousSession) -> None:
    if session.expires_at <= utcnow():
        raise Unauthorized("This session has expired. Start a new session.", code="session_expired")


def ensure_engine_compatible(session: AnonymousSession) -> None:
    """Refuse to feed one engine's state to a different engine (or version)."""
    if session.engine_id != get_engine().engine_id:
        raise Conflict(
            "This session was started with a different version of the simulation. Start a new session.",
            code="session_engine_mismatch",
        )


def build_view(session: AnonymousSession) -> dict[str, Any]:
    engine = get_engine()
    occupation = session.occupation
    current = None
    if session.current_scenario_id is not None:
        ensure_engine_compatible(session)
        content = build_engine_content(occupation, session.content_version)
        current = engine.present_scenario(content, str(session.current_scenario_id), session.state)
    history = [
        {
            "step_index": record.step_index,
            "scenario": {"id": str(record.scenario_id), "title": record.scenario.title},
            "choice": {"id": str(record.choice_id), "label": record.choice.label},
            "feedback": record.choice.feedback,
            "pathway_kind": record.choice.pathway_kind,
            "chosen_at": s.iso(record.created_at),
        }
        for record in session_repository.list_choices(session.id)
    ]
    return {
        "status": session.status,
        "occupation": {"slug": occupation.slug, "name": occupation.name},
        "content_version": session.content_version.version,
        "engine": engine.describe(),
        "step_count": session.step_count,
        "current_scenario": current,
        "state": session.state,
        "history": history,
        "report_available": session.status == "completed",
        "report_generated": report_repository.get_by_session(session.id) is not None,
        "created_at": s.iso(session.created_at),
        "expires_at": s.iso(session.expires_at),
        "completed_at": s.iso(session.completed_at),
    }
