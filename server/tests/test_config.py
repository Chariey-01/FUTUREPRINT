import pytest

from app import create_app
from app.config import ConfigError, load_settings

BASE = {"DATABASE_URL": "postgresql://u:p@localhost:5432/futureprint_test", "SECRET_KEY": "x" * 32}


def test_loads_from_environment_and_normalises_driver():
    s = load_settings(env=BASE)
    assert s.database_url == "postgresql+psycopg://u:p@localhost:5432/futureprint_test"
    assert s.app_env == "development"
    assert s.cors_origins == ("http://localhost:5173",)
    assert s.ai_insights_enabled is False
    assert s.database_name == "futureprint_test"


def test_heroku_style_url_is_normalised():
    s = load_settings(env={**BASE, "DATABASE_URL": "postgres://u@h/db"})
    assert s.database_url.startswith("postgresql+psycopg://")


def test_cors_origins_are_split_and_trimmed():
    s = load_settings(env={**BASE, "CORS_ORIGINS": "http://a.test/, https://b.test "})
    assert s.cors_origins == ("http://a.test", "https://b.test")


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"DATABASE_URL": "mysql://u@h/db"}, "DATABASE_URL"),
        ({"SECRET_KEY": "short"}, "SECRET_KEY"),
        ({"APP_ENV": "staging"}, "APP_ENV"),
        ({"SESSION_TTL_HOURS": "0"}, "SESSION_TTL_HOURS"),
        ({"AI_INSIGHTS_ENABLED": "true"}, "OPENAI_API_KEY"),
        ({"AI_INSIGHTS_ENABLED": "true", "OPENAI_API_KEY": "sk-test"}, "OPENAI_MODEL"),
    ],
)
def test_invalid_configuration_fails_fast_with_readable_message(override, message):
    with pytest.raises(ConfigError) as exc:
        load_settings(env={**BASE, **override})
    assert message in str(exc.value)


def test_missing_required_variables():
    with pytest.raises(ConfigError) as exc:
        load_settings(env={})
    assert "DATABASE_URL" in str(exc.value) and "SECRET_KEY" in str(exc.value)


def test_production_rules():
    with pytest.raises(ConfigError, match="at least 32"):
        load_settings(env={**BASE, "APP_ENV": "production", "SECRET_KEY": "y" * 20})
    with pytest.raises(ConfigError, match="CORS_ORIGINS"):
        load_settings(env={**BASE, "APP_ENV": "production", "CORS_ORIGINS": "*"})


def test_secret_is_not_exposed_in_repr():
    s = load_settings(env=BASE)
    assert "x" * 32 not in repr(s)


def test_create_app_does_not_need_a_database_connection():
    s = load_settings(env={**BASE, "DATABASE_URL": "postgresql://u@127.0.0.1:1/nowhere_test"})
    app = create_app(s)
    assert app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgresql+psycopg://")
    assert "api_v1" in app.blueprints


def test_unknown_engine_module_fails_fast():
    s = load_settings(env={**BASE, "SCENARIO_ENGINE_MODULE": "does.not.exist"})
    with pytest.raises(ConfigError, match="could not be imported"):
        create_app(s)
