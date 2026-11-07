from __future__ import annotations

from flask import jsonify

from app.api import api_v1
from app.api._helpers import require_slug
from app.services import occupation_service


@api_v1.get("/occupations")
def list_occupations():  # type: ignore[no-untyped-def]
    return jsonify(occupation_service.list_occupations())


@api_v1.get("/occupations/<slug>")
def get_occupation(slug: str):  # type: ignore[no-untyped-def]
    require_slug(slug, "occupation_not_found")
    return jsonify(occupation_service.get_occupation(slug))
