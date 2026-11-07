"""Token generation and hashing.

* Session bearer tokens are 256-bit random values from :mod:`secrets`. Only
  their SHA-256 hash is stored, so a database leak does not reveal usable
  tokens. SHA-256 (rather than a slow password hash) is appropriate here
  because the tokens are high-entropy random values, not human passwords.
* Report share tokens are derived with HMAC-SHA256 over the report id using
  the server secret. That makes them unguessable without the secret, while
  letting the session owner retrieve the same link again (report creation is
  idempotent) without the server ever storing the raw token. Only the SHA-256
  hash of the share token is stored and used for lookup.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import uuid

SESSION_TOKEN_PREFIX = "fps_"
SESSION_TOKEN_PATTERN = re.compile(r"^fps_[A-Za-z0-9_-]{43}$")
SHARE_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")
_SHARE_CONTEXT = b"futureprint:report-share:v1:"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_session_token() -> str:
    return SESSION_TOKEN_PREFIX + secrets.token_urlsafe(32)


def is_well_formed_session_token(token: str) -> bool:
    return bool(SESSION_TOKEN_PATTERN.fullmatch(token))


def derive_share_token(secret_key: str, report_id: uuid.UUID) -> str:
    digest = hmac.new(secret_key.encode("utf-8"), _SHARE_CONTEXT + report_id.bytes, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def is_well_formed_share_token(token: str) -> bool:
    return bool(SHARE_TOKEN_PATTERN.fullmatch(token))
