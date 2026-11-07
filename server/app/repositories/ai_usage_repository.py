"""Persistence for AI insights usage accounting."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select

from app.extensions import db
from app.models import AIUsageRecord


def record(
    *,
    session_id: uuid.UUID | None,
    feature: str,
    model: str,
    status: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    estimated_cost_usd: Decimal | None = None,
    latency_ms: int = 0,
    error_code: str | None = None,
) -> None:
    db.session.add(
        AIUsageRecord(
            session_id=session_id,
            feature=feature,
            model=model,
            status=status,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost_usd,
            latency_ms=latency_ms,
            error_code=error_code,
        )
    )
    db.session.commit()


def count_billable_for_session(session_id: uuid.UUID) -> int:
    stmt = select(func.count(AIUsageRecord.id)).where(
        AIUsageRecord.session_id == session_id, AIUsageRecord.status != "cached"
    )
    return int(db.session.execute(stmt).scalar_one())
