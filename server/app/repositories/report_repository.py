"""Persistence for immutable FUTUREPRINT reports."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from app.extensions import db
from app.models import FutureprintReport


def get_by_session(session_id: uuid.UUID) -> FutureprintReport | None:
    return db.session.execute(
        select(FutureprintReport).where(FutureprintReport.session_id == session_id)
    ).scalar_one_or_none()


def get_by_share_token_hash(token_hash: str) -> FutureprintReport | None:
    return db.session.execute(
        select(FutureprintReport).where(FutureprintReport.share_token_hash == token_hash)
    ).scalar_one_or_none()


def create(
    *,
    report_id: uuid.UUID,
    session_id: uuid.UUID,
    occupation_id: uuid.UUID,
    content_version_id: uuid.UUID,
    share_token_hash: str,
    snapshot: dict[str, Any],
    snapshot_sha256: str,
) -> FutureprintReport:
    report = FutureprintReport(
        id=report_id,
        session_id=session_id,
        occupation_id=occupation_id,
        content_version_id=content_version_id,
        share_token_hash=share_token_hash,
        snapshot=snapshot,
        snapshot_sha256=snapshot_sha256,
    )
    db.session.add(report)
    db.session.flush()
    return report
