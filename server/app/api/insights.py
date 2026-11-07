from __future__ import annotations

from flask import g, jsonify

from app.api import api_v1
from app.api._helpers import no_store, parse_body, session_required
from app.schemas.requests import InsightRequest
from app.services import insights_service


@api_v1.get("/insights/status")
def insights_status():  # type: ignore[no-untyped-def]
    return jsonify(insights_service.status())


@api_v1.post("/insights/explain")
@session_required
def explain():  # type: ignore[no-untyped-def]
    payload = parse_body(InsightRequest)
    return no_store(jsonify(insights_service.explain(g.anonymous_session, payload)))
