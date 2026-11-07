"""Liveness and readiness checks. Never exposes configuration or errors."""

from __future__ import annotations

import logging
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory

from app import MIGRATIONS_DIR, __version__
from app.repositories import health_repository

logger = logging.getLogger(__name__)


def _expected_head() -> str | None:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return ScriptDirectory.from_config(config).get_current_head()


def health() -> tuple[dict[str, Any], int]:
    try:
        health_repository.ping()
        database = "ok"
    except Exception:
        logger.warning("health_database_unavailable", exc_info=True)
        health_repository.rollback()
        database = "unavailable"
    ok = database == "ok"
    return {"status": "ok" if ok else "degraded", "version": __version__, "database": database}, (200 if ok else 503)


def readiness() -> tuple[dict[str, Any], int]:
    checks: dict[str, Any] = {}
    try:
        health_repository.ping()
        checks["database"] = "ok"
        current = health_repository.current_migration_revision()
        checks["migrations"] = "ok" if current is not None and current == _expected_head() else "pending"
        checks["content"] = "ok" if health_repository.active_content_version() else "not_loaded"
    except Exception:
        logger.warning("readiness_check_failed", exc_info=True)
        health_repository.rollback()
        checks.setdefault("database", "unavailable")
        checks.setdefault("migrations", "unknown")
        checks.setdefault("content", "unknown")
    ready = all(v == "ok" for v in checks.values())
    return {"status": "ready" if ready else "not_ready", "checks": checks}, (200 if ready else 503)
