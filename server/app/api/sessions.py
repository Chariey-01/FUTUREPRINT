from __future__ import annotations

from flask import g, jsonify

from app.api import api_v1
from app.api._helpers import no_store, parse_body, require_no_body, session_required
from app.schemas.requests import CreateSessionRequest, SubmitChoiceRequest
from app.services import report_service, session_service, simulation_service


@api_v1.post("/sessions")
def create_session():  # type: ignore[no-untyped-def]
    payload = parse_body(CreateSessionRequest)
    token, view = session_service.create_session(payload.occupation_slug)
    body = {"session_token": token, "token_type": "Bearer", "expires_at": view["expires_at"], "session": view}
    return no_store(jsonify(body)), 201


@api_v1.get("/sessions/current")
@session_required
def current_session():  # type: ignore[no-untyped-def]
    return no_store(jsonify({"session": session_service.build_view(g.anonymous_session)}))


@api_v1.post("/sessions/current/choices")
@session_required
def submit_choice():  # type: ignore[no-untyped-def]
    payload = parse_body(SubmitChoiceRequest)
    result = simulation_service.submit_choice(g.anonymous_session.id, payload.choice_id)
    return no_store(jsonify(result))


@api_v1.post("/sessions/current/report")
@session_required
def create_report():  # type: ignore[no-untyped-def]
    require_no_body()
    result = report_service.create_or_get_report(g.anonymous_session.id)
    return no_store(jsonify(result)), (201 if result["created"] else 200)
