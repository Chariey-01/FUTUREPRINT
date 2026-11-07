"""Immutable FUTUREPRINT report generation and sharing.

* Generation is idempotent: one report per session. Repeat requests return
  the existing snapshot and the same share link.
* The snapshot is built only from server-side state (validated choices and
  the persisted engine state); nothing from the request body is used.
* Share tokens are separate from session tokens and unguessable; see
  :mod:`app.security`.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from typing import Any

from sqlalchemy.exc import IntegrityError

from app import get_settings
from app.engine.adapter import EngineError
from app.errors import ApiError, Conflict, NotFound, Unauthorized
from app.models import AnonymousSession, FutureprintReport
from app.repositories import content_repository, report_repository, session_repository
from app.security import derive_share_token, is_well_formed_share_token, sha256_hex
from app.services import serializers as s
from app.services import session_service
from app.services.content_service import build_engine_content, get_engine

logger = logging.getLogger(__name__)

SNAPSHOT_SCHEMA_VERSION = 1
DISCLAIMER = (
    "This FUTUREPRINT report reflects the choices you made in an illustrative simulation. "
    "It is not a prediction about your job or career. AI exposure describes how much of an "
    "occupation's tasks generative AI could potentially affect; it does not measure job loss. "
    "Evidence is summarised from the cited public sources, which have limitations described "
    "alongside each source."
)


class ReportEngineFailure(ApiError):
    status_code = 500
    code = "engine_error"
    message = "The report could not be generated."


def _share_payload(report: FutureprintReport, created: bool) -> dict[str, Any]:
    token = derive_share_token(get_settings().secret_key.get_secret_value(), report.id)
    return {
        "created": created,
        "report_id": str(report.id),
        "created_at": s.iso(report.created_at),
        "share_token": token,
        "share_path": f"/api/v1/reports/{token}",
        "report": report.snapshot,
    }


def _canonical_sha256(snapshot: dict[str, Any]) -> str:
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _build_snapshot(session: AnonymousSession, engine_report: dict[str, Any], content: dict[str, Any]) -> dict[str, Any]:
    occupation = session.occupation
    records = session_repository.list_choices(session.id)
    links = content_repository.evidence_links_for(occupation_ids=[occupation.id])
    scenarios = content["scenarios"]
    engine = get_engine()
    return {
        "schema_version": SNAPSHOT_SCHEMA_VERSION,
        "generated_at": s.iso(session_service.utcnow()),
        "content_version": session.content_version.version,
        "engine": engine.describe(),
        "occupation": {
            "slug": occupation.slug,
            "name": occupation.name,
            "category": occupation.category,
            "isco_08_code": occupation.isco_08_code,
            "isco_08_title": occupation.isco_08_title,
            "summary": occupation.summary,
            "exposure": s.exposure(occupation),
        },
        "journey": [
            {
                "step_index": r.step_index,
                "scenario_title": r.scenario.title,
                "task": scenarios.get(str(r.scenario_id), {}).get("task"),
                "choice_label": r.choice.label,
                "pathway_kind": r.choice.pathway_kind,
                "feedback": r.choice.feedback,
            }
            for r in records
        ],
        "final_state": session.state,
        "insights": engine_report,
        "pathways": content["pathways"],
        "evidence": [s.evidence_reference(link) for link in links],
        "disclaimer": DISCLAIMER,
    }


def create_or_get_report(session_id: uuid.UUID) -> dict[str, Any]:
    engine = get_engine()
    try:
        session = session_repository.get_for_update(session_id)
        if session is None:
            raise Unauthorized("A valid session token is required.", code="invalid_token")
        session_service.ensure_not_expired(session)
        if session.status != "completed":
            raise Conflict("Finish the simulation before generating a report.", code="session_not_completed")

        existing = report_repository.get_by_session(session.id)
        if existing is not None:
            session_repository.commit()  # release the row lock
            return _share_payload(existing, created=False)

        session_service.ensure_engine_compatible(session)
        content = build_engine_content(session.occupation, session.content_version)
        engine_choices = [
            {"step_index": r.step_index, "scenario_id": str(r.scenario_id), "choice_id": str(r.choice_id)}
            for r in session_repository.list_choices(session.id)
        ]
        try:
            engine_report = engine.generate_report(content, session.occupation.slug, engine_choices, session.state)
        except EngineError as exc:
            raise ReportEngineFailure() from exc

        snapshot = _build_snapshot(session, engine_report, content)
        report_id = uuid.uuid4()
        token = derive_share_token(get_settings().secret_key.get_secret_value(), report_id)
        report = report_repository.create(
            report_id=report_id,
            session_id=session.id,
            occupation_id=session.occupation_id,
            content_version_id=session.content_version_id,
            share_token_hash=sha256_hex(token),
            snapshot=snapshot,
            snapshot_sha256=_canonical_sha256(snapshot),
        )
        session_repository.commit()
        return _share_payload(report, created=True)
    except IntegrityError:
        # Another request created the report first; return that one.
        session_repository.rollback()
        existing = report_repository.get_by_session(session_id)
        if existing is None:
            raise
        return _share_payload(existing, created=False)
    except Exception:
        session_repository.rollback()
        raise


def get_shared_report(share_token: str) -> dict[str, Any]:
    if not is_well_formed_share_token(share_token):
        raise NotFound("Report not found.", code="report_not_found")
    report = report_repository.get_by_share_token_hash(sha256_hex(share_token))
    if report is None:
        raise NotFound("Report not found.", code="report_not_found")
    return {
        "report_id": str(report.id),
        "created_at": s.iso(report.created_at),
        "content_version": report.snapshot.get("content_version"),
        "integrity_sha256": report.snapshot_sha256,
        "report": report.snapshot,
    }
