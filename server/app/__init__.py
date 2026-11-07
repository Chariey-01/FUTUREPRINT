"""FUTUREPRINT backend application factory."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, current_app

from app import models  # noqa: F401  (registers all tables on the metadata)
from app.config import Settings, load_settings
from app.errors import register_error_handlers
from app.extensions import cors, db, migrate
from app.logging_config import configure_logging, register_request_logging
from app.security import register_security_headers

__version__ = "0.1.0"

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
SETTINGS_KEY = "futureprint.settings"
ENGINE_KEY = "futureprint.engine"


def create_app(settings: Settings | None = None) -> Flask:
    """Create and configure a Flask application.

    ``settings`` lets tests inject configuration; otherwise it is read and
    validated from environment variables.
    """
    settings = settings or load_settings()
    configure_logging(settings.log_level, settings.log_format)

    flask_app = Flask(__name__)
    flask_app.config.update(
        SECRET_KEY=settings.secret_key.get_secret_value(),
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "connect_args": {"connect_timeout": 5}},
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=64 * 1024,
        TESTING=settings.app_env == "testing",
    )
    flask_app.json.sort_keys = False  # type: ignore[attr-defined]
    flask_app.extensions[SETTINGS_KEY] = settings

    db.init_app(flask_app)
    migrate.init_app(flask_app, db, directory=str(MIGRATIONS_DIR))
    cors.init_app(
        flask_app,
        resources={r"/api/*": {"origins": list(settings.cors_origins)}},
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        supports_credentials=False,
        max_age=600,
    )

    register_error_handlers(flask_app)
    register_request_logging(flask_app)
    register_security_headers(flask_app)

    from app.engine.adapter import load_engine

    flask_app.extensions[ENGINE_KEY] = load_engine(
        settings.scenario_engine_module, allow_reference=settings.reference_engine_allowed
    )

    from app.api import api_v1

    flask_app.register_blueprint(api_v1)

    from app.cli import register_cli

    register_cli(flask_app)
    return flask_app


def get_settings() -> Settings:
    return current_app.extensions[SETTINGS_KEY]
