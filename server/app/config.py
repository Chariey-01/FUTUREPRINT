"""Environment-based configuration.

All configuration comes from environment variables (optionally loaded from
``server/.env`` by python-dotenv). Values are validated with Pydantic at
start-up so a misconfigured deployment fails fast with a readable message
instead of failing later on the first request.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    ValidationError,
    field_validator,
    model_validator,
)

AppEnv = Literal["development", "testing", "production"]

# Environment variable name -> Settings field name.
ENV_VARS: dict[str, str] = {
    "APP_ENV": "app_env",
    "DATABASE_URL": "database_url",
    "SECRET_KEY": "secret_key",
    "CORS_ORIGINS": "cors_origins",
    "SESSION_TTL_HOURS": "session_ttl_hours",
    "LOG_LEVEL": "log_level",
    "LOG_FORMAT": "log_format",
    "SCENARIO_ENGINE_MODULE": "scenario_engine_module",
    "AI_INSIGHTS_ENABLED": "ai_insights_enabled",
    "OPENAI_API_KEY": "openai_api_key",
    "OPENAI_MODEL": "openai_model",
    "OPENAI_TIMEOUT_SECONDS": "openai_timeout_seconds",
    "AI_MAX_QUESTION_CHARS": "ai_max_question_chars",
    "AI_MAX_OUTPUT_TOKENS": "ai_max_output_tokens",
    "AI_MAX_REQUESTS_PER_SESSION": "ai_max_requests_per_session",
    "AI_CACHE_TTL_SECONDS": "ai_cache_ttl_seconds",
    "AI_INPUT_COST_PER_1M_TOKENS": "ai_input_cost_per_1m_tokens",
    "AI_OUTPUT_COST_PER_1M_TOKENS": "ai_output_cost_per_1m_tokens",
}


class ConfigError(RuntimeError):
    """Raised when the environment does not describe a valid configuration."""


class Settings(BaseModel):
    """Validated application settings."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    app_env: AppEnv = "development"
    database_url: str
    secret_key: SecretStr
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    session_ttl_hours: int = Field(default=72, ge=1, le=24 * 30)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"
    scenario_engine_module: str | None = None

    ai_insights_enabled: bool = False
    openai_api_key: SecretStr | None = None
    openai_model: str | None = None
    openai_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    ai_max_question_chars: int = Field(default=500, ge=20, le=4000)
    ai_max_output_tokens: int = Field(default=600, ge=50, le=4000)
    ai_max_requests_per_session: int = Field(default=20, ge=1, le=1000)
    ai_cache_ttl_seconds: int = Field(default=3600, ge=0, le=7 * 24 * 3600)
    ai_input_cost_per_1m_tokens: float | None = Field(default=None, ge=0)
    ai_output_cost_per_1m_tokens: float | None = Field(default=None, ge=0)

    @field_validator("app_env", "log_level", "log_format", mode="before")
    @classmethod
    def _normalise_case(cls, value: Any, info: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            return value.upper() if info.field_name == "log_level" else value.lower()
        return value

    @field_validator("database_url")
    @classmethod
    def _normalise_database_url(cls, value: str) -> str:
        value = value.strip()
        # psycopg 3 is the installed driver; SQLAlchemy defaults plain
        # "postgresql://" URLs to psycopg2, so make the driver explicit.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must be a PostgreSQL URL (postgresql://...)")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return tuple(o.strip().rstrip("/") for o in value.split(",") if o.strip())
        return value

    @field_validator("scenario_engine_module", "openai_model", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value.strip() if isinstance(value, str) else value

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def _blank_secret_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _cross_field_rules(self) -> Settings:
        secret = self.secret_key.get_secret_value()
        min_len = 32 if self.app_env == "production" else 16
        if len(secret) < min_len:
            raise ValueError(f"SECRET_KEY must be at least {min_len} characters in {self.app_env}")
        if self.app_env == "production" and "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS must list explicit origins in production, not '*'")
        if self.ai_insights_enabled:
            if self.openai_api_key is None:
                raise ValueError("OPENAI_API_KEY is required when AI_INSIGHTS_ENABLED=true")
            if self.openai_model is None:
                raise ValueError("OPENAI_MODEL is required when AI_INSIGHTS_ENABLED=true")
        return self

    @property
    def database_name(self) -> str:
        path = self.database_url.split("?", 1)[0]
        return path.rsplit("/", 1)[-1]


def load_settings(env: Mapping[str, str] | None = None, **overrides: Any) -> Settings:
    """Build :class:`Settings` from environment variables plus explicit overrides."""
    source = os.environ if env is None else env
    raw: dict[str, Any] = {}
    for var, field in ENV_VARS.items():
        if var in source and source[var] != "":
            raw[field] = source[var]
    raw.update(overrides)
    try:
        return Settings(**raw)
    except ValidationError as exc:
        problems = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"]) or "settings"
            var = next((k for k, v in ENV_VARS.items() if v == loc), loc)
            problems.append(f"{var}: {err['msg']}")
        raise ConfigError("Invalid configuration -> " + "; ".join(problems)) from None
