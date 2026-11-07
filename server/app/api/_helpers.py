"""Shared request-parsing helpers for route handlers."""

from __future__ import annotations

import re
from functools import wraps
from typing import Any, Callable, TypeVar

from flask import Response, g, request
from pydantic import BaseModel

from app.errors import ApiError, BadRequest, NotFound, ValidationFailed
from app.services import session_service

M = TypeVar("M", bound=BaseModel)
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class UnsupportedMediaType(ApiError):
    status_code = 415
    code = "unsupported_media_type"
    message = "Content-Type must be application/json."


def parse_body(model: type[M]) -> M:
    if not request.is_json:
        raise UnsupportedMediaType()
    data = request.get_json(silent=True)
    if data is None:
        raise BadRequest("The request body must be valid JSON.", code="invalid_json")
    if not isinstance(data, dict):
        raise ValidationFailed("The request body must be a JSON object.")
    return model.model_validate(data)


def require_no_body() -> None:
    """For endpoints that take no input: allow an empty body or ``{}`` only."""
    if not request.get_data(cache=True):
        return
    data = request.get_json(silent=True)
    if data is None:
        raise BadRequest("The request body must be valid JSON.", code="invalid_json")
    if data != {}:
        raise ValidationFailed("This endpoint does not accept request fields.", code="unexpected_fields")


def parse_query(model: type[M]) -> M:
    return model.model_validate(request.args.to_dict(flat=True))


def require_slug(value: str, not_found_code: str) -> str:
    if len(value) > 120 or not SLUG_PATTERN.fullmatch(value):
        raise NotFound(code=not_found_code)
    return value


def bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


F = TypeVar("F", bound=Callable[..., Any])


def session_required(view: F) -> F:
    """Authenticate the bearer token and expose the session as ``g.anonymous_session``."""

    @wraps(view)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        g.anonymous_session = session_service.authenticate(bearer_token())
        return view(*args, **kwargs)

    return wrapper  # type: ignore[return-value]


def no_store(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store"
    return response
