"""Persistence for anonymous sessions and their recorded choices."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import AnonymousSession, UserChoice


def create(
    *,
    token_hash: str,
    occupation_id: uuid.UUID,
    content_version_id: uuid.UUID,
    current_scenario_id: uuid.UUID,
    state: dict[str, Any],
    engine_id: str,
    expires_at: datetime,
) -> AnonymousSession:
    session = AnonymousSession(
        token_hash=token_hash,
        occupation_id=occupation_id,
        content_version_id=content_version_id,
        current_scenario_id=current_scenario_id,
        state=state,
        engine_id=engine_id,
        status="active",
        step_count=0,
        expires_at=expires_at,
    )
    db.session.add(session)
    db.session.flush()
    return session


def get_by_token_hash(token_hash: str) -> AnonymousSession | None:
    return db.session.execute(
        select(AnonymousSession).where(AnonymousSession.token_hash == token_hash)
    ).scalar_one_or_none()


def get(session_id: uuid.UUID) -> AnonymousSession | None:
    return db.session.get(AnonymousSession, session_id)


def get_for_update(session_id: uuid.UUID) -> AnonymousSession | None:
    """Lock the session row (``SELECT ... FOR UPDATE``) for the rest of the
    transaction so concurrent writers for the same session are serialised."""
    stmt = (
        select(AnonymousSession)
        .where(AnonymousSession.id == session_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return db.session.execute(stmt).scalar_one_or_none()


def list_choices(session_id: uuid.UUID) -> Sequence[UserChoice]:
    stmt = (
        select(UserChoice)
        .where(UserChoice.session_id == session_id)
        .options(selectinload(UserChoice.scenario), selectinload(UserChoice.choice))
        .order_by(UserChoice.step_index)
    )
    return db.session.execute(stmt).scalars().all()


def find_recorded_choice(session_id: uuid.UUID, choice_id: uuid.UUID) -> UserChoice | None:
    stmt = select(UserChoice).where(UserChoice.session_id == session_id, UserChoice.choice_id == choice_id)
    return db.session.execute(stmt).scalar_one_or_none()


def add_choice(
    *,
    session_id: uuid.UUID,
    step_index: int,
    scenario_id: uuid.UUID,
    choice_id: uuid.UUID,
    state_after: dict[str, Any],
) -> UserChoice:
    record = UserChoice(
        session_id=session_id,
        step_index=step_index,
        scenario_id=scenario_id,
        choice_id=choice_id,
        state_after=state_after,
    )
    db.session.add(record)
    db.session.flush()
    return record


def commit() -> None:
    db.session.commit()


def rollback() -> None:
    db.session.rollback()
