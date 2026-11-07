from __future__ import annotations

from flask import jsonify

from app.api import api_v1
from app.services import health_service


@api_v1.get("/health")
def health():  # type: ignore[no-untyped-def]
    body, status = health_service.health()
    return jsonify(body), status


@api_v1.get("/health/ready")
def readiness():  # type: ignore[no-untyped-def]
    body, status = health_service.readiness()
    return jsonify(body), status
