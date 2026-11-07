from __future__ import annotations

from flask import jsonify

from app.api import api_v1
from app.services import report_service


@api_v1.get("/reports/<share_token>")
def get_shared_report(share_token: str):  # type: ignore[no-untyped-def]
    response = jsonify(report_service.get_shared_report(share_token))
    # The token is in the URL: stop it leaking via caches, referrers or indexing.
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response
