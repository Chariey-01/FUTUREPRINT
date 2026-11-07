"""Shared pytest fixtures.

Tests run against a real PostgreSQL database named by ``TEST_DATABASE_URL``,
because row locking, JSONB, partial indexes and the report-immutability
trigger are PostgreSQL behaviour. As a safety guard, the database name must
end in ``_test``. The schema is rebuilt from the Alembic migrations once per
run, and every table is truncated after each test.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
from flask_migrate import upgrade
from sqlalchemy import text

from app import create_app
from app.config import Settings, load_settings
from app.extensions import db
from tests.fixtures.minimal_dataset import build_minimal_dataset

TEST_SECRET = "test-secret-key-0123456789abcdef-not-for-production"


@pytest.fixture(scope="session")
def settings() -> Settings:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.exit("TEST_DATABASE_URL is not set. See server/README.md#running-tests.", returncode=2)
    s = load_settings(
        env={},
        app_env="testing",
        database_url=url,
        secret_key=TEST_SECRET,
        log_level="WARNING",
        log_format="text",
        cors_origins="http://localhost:5173",
    )
    if not s.database_name.endswith("_test"):
        pytest.exit(f"Refusing to run tests against '{s.database_name}': name must end with '_test'.", returncode=2)
    return s


@pytest.fixture(scope="session")
def app(settings: Settings):
    flask_app = create_app(settings)
    with flask_app.app_context():
        db.session.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        db.session.execute(text("CREATE SCHEMA public"))
        db.session.commit()
        upgrade()
    yield flask_app
    with flask_app.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture(autouse=True)
def _clean_database(app):
    yield
    with app.app_context():
        db.session.remove()
        tables = ", ".join(t.name for t in db.metadata.sorted_tables)
        db.session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


def write_dataset(directory: Path, payload: dict[str, Any]) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for filename, content in payload.items():
        (directory / filename).write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
    return directory


@pytest.fixture
def minimal_dataset() -> dict[str, Any]:
    return build_minimal_dataset()


@pytest.fixture
def seed_dir(tmp_path: Path, minimal_dataset: dict[str, Any]) -> Path:
    return write_dataset(tmp_path / "seed", minimal_dataset)


@pytest.fixture
def seeded(app, seed_dir: Path):
    from app.seed.loader import load_dataset

    with app.app_context():
        return load_dataset(seed_dir)


@pytest.fixture
def new_session(client, seeded):
    """Create a session for the test occupation and return (token, body)."""

    def _create(occupation: str = "test-occupation") -> tuple[str, dict[str, Any]]:
        response = client.post("/api/v1/sessions", json={"occupation_slug": occupation})
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        return body["session_token"], body

    return _create


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
