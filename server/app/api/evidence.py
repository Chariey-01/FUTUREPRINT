from __future__ import annotations

from flask import jsonify

from app.api import api_v1
from app.api._helpers import parse_query, require_slug
from app.schemas.requests import EvidenceQuery
from app.services import evidence_service


@api_v1.get("/evidence")
def list_evidence():  # type: ignore[no-untyped-def]
    query = parse_query(EvidenceQuery)
    return jsonify(evidence_service.list_sources(query.region, query.category))


@api_v1.get("/evidence/<key>")
def get_evidence(key: str):  # type: ignore[no-untyped-def]
    require_slug(key, "source_not_found")
    return jsonify(evidence_service.get_source(key))


@api_v1.get("/workforce-events")
def list_workforce_events():  # type: ignore[no-untyped-def]
    return jsonify(evidence_service.list_workforce_events())


@api_v1.get("/methodology")
def methodology():  # type: ignore[no-untyped-def]
    return jsonify(evidence_service.methodology())
