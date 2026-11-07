"""Versioned REST API (``/api/v1``)."""

from __future__ import annotations

from flask import Blueprint

api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")

# Route modules register their handlers on ``api_v1`` when imported.
from app.api import evidence, health, occupations, reports, sessions  # noqa: E402,F401
