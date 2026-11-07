"""Structured logging and request correlation.

Logs are emitted as one JSON object per line (or plain text for local
development). Request logs record the matched route *pattern* rather than the
raw path so that tokens embedded in URLs (report share tokens) are never
written to logs. Headers and request bodies are never logged.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from flask import Flask, Response, g, request

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,64}$")
_STANDARD_ATTRS = set(vars(logging.LogRecord("", 0, "", 0, "", (), None))) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = _current_request_id()
        if request_id:
            entry["request_id"] = request_id
        for key, value in vars(record).items():
            if key not in _STANDARD_ATTRS and not key.startswith("_"):
                entry[key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def _current_request_id() -> str | None:
    try:
        return getattr(g, "request_id", None)
    except RuntimeError:  # outside an application context
        return None


def configure_logging(level: str, fmt: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # SQL statements may contain parameter values; never log them by default.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


def register_request_logging(app: Flask) -> None:
    access_log = logging.getLogger("futureprint.access")

    @app.before_request
    def _start_request() -> None:
        incoming = request.headers.get("X-Request-ID", "")
        g.request_id = incoming if REQUEST_ID_PATTERN.match(incoming) else uuid.uuid4().hex
        g.request_started = time.perf_counter()

    @app.after_request
    def _finish_request(response: Response) -> Response:
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        started = getattr(g, "request_started", None)
        duration_ms = round((time.perf_counter() - started) * 1000, 1) if started else None
        access_log.info(
            "request",
            extra={
                "method": request.method,
                "route": request.url_rule.rule if request.url_rule else "<unmatched>",
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
