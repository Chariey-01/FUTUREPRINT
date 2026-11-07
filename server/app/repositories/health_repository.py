"""Low-level connectivity checks used by the health endpoints."""

from __future__ import annotations

from sqlalchemy import text

from app.extensions import db


def ping() -> None:
    db.session.execute(text("SELECT 1"))


def current_migration_revision() -> str | None:
    row = db.session.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
    return row[0] if row else None


def active_content_version() -> str | None:
    row = db.session.execute(text("SELECT version FROM content_versions WHERE is_active LIMIT 1")).first()
    return row[0] if row else None


def rollback() -> None:
    db.session.rollback()
