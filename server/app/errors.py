"""Centralised JSON error handling.

Every error response has the shape::

    {"error": {"code": "...", "message": "...", "details": [...], "request_id": "..."}}

Unexpected exceptions are logged server-side with a stack trace and returned
to the client as a generic 500 without internal details.
"""

from __future__ import annotations

import logging
from typing import Any

from flask import Flask, g, jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    status_code = 400
    code = "bad_request"
    message = "The request could not be processed."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details
        self.headers = headers or {}


class BadRequest(ApiError):
    status_code = 400
    code = "bad_request"


class ValidationFailed(ApiError):
    status_code = 422
    code = "validation_error"
    message = "The request payload is invalid."


class Unauthorized(ApiError):
    status_code = 401
    code = "unauthorized"
    message = "A valid session token is required."

    def __init__(self, message: str | None = None, *, code: str | None = None) -> None:
        super().__init__(message, code=code, headers={"WWW-Authenticate": 'Bearer realm="futureprint"'})


class NotFound(ApiError):
    status_code = 404
    code = "not_found"
    message = "The requested resource was not found."


class Conflict(ApiError):
    status_code = 409
    code = "conflict"
    message = "The request conflicts with the current state of the resource."


class ServiceUnavailable(ApiError):
    status_code = 503
    code = "service_unavailable"
    message = "The service is temporarily unavailable."


def pydantic_details(exc: ValidationError) -> list[dict[str, Any]]:
    """Convert a Pydantic error into client-safe details (no input echo)."""
    details = []
    for err in exc.errors(include_url=False, include_input=False, include_context=False):
        details.append(
            {
                "field": ".".join(str(p) for p in err["loc"]) or None,
                "message": err["msg"],
                "type": err["type"],
            }
        )
    return details


def _payload(code: str, message: str, details: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if details:
        body["details"] = details
    request_id = getattr(g, "request_id", None)
    if request_id:
        body["request_id"] = request_id
    return {"error": body}


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def _handle_api_error(exc: ApiError):  # type: ignore[no-untyped-def]
        response = jsonify(_payload(exc.code, exc.message, exc.details))
        response.status_code = exc.status_code
        for key, value in exc.headers.items():
            response.headers[key] = value
        return response

    @app.errorhandler(ValidationError)
    def _handle_validation_error(exc: ValidationError):  # type: ignore[no-untyped-def]
        response = jsonify(_payload("validation_error", "The request payload is invalid.", pydantic_details(exc)))
        response.status_code = 422
        return response

    @app.errorhandler(HTTPException)
    def _handle_http_exception(exc: HTTPException):  # type: ignore[no-untyped-def]
        code = (exc.name or "http_error").lower().replace(" ", "_")
        response = jsonify(_payload(code, exc.description or exc.name or "HTTP error"))
        response.status_code = exc.code or 500
        if exc.code == 405 and getattr(exc, "valid_methods", None):
            response.headers["Allow"] = ", ".join(exc.valid_methods)  # type: ignore[attr-defined]
        return response

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):  # type: ignore[no-untyped-def]
        logger.exception("unhandled_exception", extra={"error_type": type(exc).__name__})
        response = jsonify(_payload("internal_error", "An unexpected error occurred."))
        response.status_code = 500
        return response
