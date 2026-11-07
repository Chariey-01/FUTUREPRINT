"""Engine integration: start-up checks, production guard, pluggability,
error translation, session/engine identity and the conformance checker."""

import sys
import types

import pytest
from sqlalchemy import func, select

from app import ENGINE_KEY, create_app
from app.config import ConfigError, load_settings
from app.engine import reference
from app.engine.adapter import EngineAdapter, load_engine
from app.extensions import db
from app.models import AnonymousSession, FutureprintReport, UserChoice
from app.seed import ids
from app.services.content_service import build_engine_content
from tests.conftest import auth

FIXTURE_ENGINE = "tests.fixtures.contract_engine"
BASE_ENV = {"DATABASE_URL": "postgresql://u@127.0.0.1:1/x_test", "SECRET_KEY": "s" * 32}


def choice(scenario: str, key: str) -> str:
    return str(ids.choice_id("test-occupation", scenario, key))


def fake_module(name: str, **overrides) -> types.ModuleType:
    module = types.ModuleType(name)
    for fn in ("start_state", "apply_choice", "generate_report", "present_scenario"):
        setattr(module, fn, overrides.pop(fn, getattr(reference, fn)))
    for key, value in overrides.items():
        setattr(module, key, value)
    return module


@pytest.fixture
def external_app(settings):
    """A second app instance on the same test database, using the fixture engine."""
    app = create_app(settings.model_copy(update={"scenario_engine_module": FIXTURE_ENGINE}))
    yield app
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


# --- start-up checks and production guard -----------------------------------------


def test_production_refuses_reference_engine_unless_overridden():
    prod = {**BASE_ENV, "APP_ENV": "production"}
    with pytest.raises(ConfigError, match="development stand-in"):
        create_app(load_settings(env=prod))
    with pytest.raises(ConfigError, match="development stand-in"):
        create_app(load_settings(env={**prod, "SCENARIO_ENGINE_MODULE": "app.engine.reference"}))
    app = create_app(load_settings(env={**prod, "ALLOW_REFERENCE_ENGINE": "true"}))
    assert app.extensions[ENGINE_KEY].is_reference is True


def test_reference_engine_allowed_by_default_outside_production_and_can_be_disabled():
    assert create_app(load_settings(env=BASE_ENV)).extensions[ENGINE_KEY].is_reference is True
    with pytest.raises(ConfigError, match="development stand-in"):
        create_app(load_settings(env={**BASE_ENV, "ALLOW_REFERENCE_ENGINE": "false"}))


def test_production_accepts_a_real_engine_module():
    app = create_app(load_settings(env={**BASE_ENV, "APP_ENV": "production", "SCENARIO_ENGINE_MODULE": FIXTURE_ENGINE}))
    engine = app.extensions[ENGINE_KEY]
    assert engine.describe() == {"name": FIXTURE_ENGINE, "version": "fixture-1", "is_reference": False}
    assert engine.engine_id == f"{FIXTURE_ENGINE}@fixture-1"


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"apply_choice": lambda content, state: None}, "apply_choice() cannot be called with 4"),
        ({"present_scenario": lambda: None}, "present_scenario() cannot be called with 3"),
        ({"start_state": lambda required: {}}, "start_state() cannot be called with 0"),
        ({"generate_report": None}, "missing function generate_report"),
        ({"InvalidChoiceError": "not a class"}, "InvalidChoiceError must be an Exception subclass"),
        ({"ENGINE_VERSION": 3}, "ENGINE_VERSION must be a string"),
        ({"start_state": lambda: ["not", "a", "dict"]}, "failed its start-up check"),
        ({"start_state": lambda: 1 / 0}, "failed its start-up check"),
    ],
)
def test_malformed_engines_fail_at_startup(monkeypatch, overrides, message):
    monkeypatch.setitem(sys.modules, "malformed_engine", fake_module("malformed_engine", **overrides))
    with pytest.raises(ConfigError) as exc:
        load_engine("malformed_engine")
    assert message in str(exc.value)


def test_engine_raising_at_import_is_a_config_error(monkeypatch, tmp_path):
    (tmp_path / "exploding_engine.py").write_text("raise RuntimeError('boom at import')\n")
    monkeypatch.syspath_prepend(str(tmp_path))
    with pytest.raises(ConfigError, match="RuntimeError: boom at import"):
        load_engine("exploding_engine")


def test_optional_attributes_are_detected():
    engine = load_engine(FIXTURE_ENGINE)
    assert engine.version == "fixture-1" and engine.is_reference is False


# --- pluggability through the HTTP API ----------------------------------------------


def test_full_flow_with_a_non_reference_engine(external_app, seeded):
    client = external_app.test_client()
    created = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()
    token, session = created["session_token"], created["session"]
    assert session["engine"] == {"name": FIXTURE_ENGINE, "version": "fixture-1", "is_reference": False}
    assert session["state"] == {"score": 0, "path": []}
    presented = session["current_scenario"]
    assert [c["label"] for c in presented["choices"]] == ["Adapt", "Transform"]  # locked "c" hidden
    assert presented["fixture_score"] == 0  # extra engine keys pass through

    step = client.post("/api/v1/sessions/current/choices", json={"choice_id": choice("s1", "a")}, headers=auth(token))
    assert step.status_code == 200
    body = step.get_json()
    assert body["accepted_choice"]["feedback"] == "fixture: Adapt"
    assert body["session"]["state"] == {"score": 3, "path": ["a"]}

    done = client.post("/api/v1/sessions/current/choices", json={"choice_id": choice("s2", "a")}, headers=auth(token))
    assert done.get_json()["completed"] is True

    report = client.post("/api/v1/sessions/current/report", headers=auth(token))
    assert report.status_code == 201
    snapshot = report.get_json()["report"]
    assert snapshot["engine"] == {"name": FIXTURE_ENGINE, "version": "fixture-1", "is_reference": False}
    assert snapshot["insights"] == {"engine": "fixture", "occupation": "test-occupation", "steps": 2, "score": 5, "path": ["a", "a"]}
    again = client.post("/api/v1/sessions/current/report", headers=auth(token))
    assert again.status_code == 200 and again.get_json()["report"] == snapshot
    with external_app.app_context():
        row = db.session.execute(select(AnonymousSession)).scalar_one()
        assert row.engine_id == f"{FIXTURE_ENGINE}@fixture-1"


def test_engine_rejection_returns_422_and_persists_nothing(external_app, seeded):
    client = external_app.test_client()
    token = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()["session_token"]
    response = client.post("/api/v1/sessions/current/choices", json={"choice_id": choice("s1", "c")}, headers=auth(token))
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "choice_rejected"
    assert "locked" not in response.get_data(as_text=True)  # engine message is logged, not returned
    with external_app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 0
        row = db.session.execute(select(AnonymousSession)).scalar_one()
        assert row.step_count == 0 and row.state == {"score": 0, "path": []}
    # The session is still usable after a rejection.
    ok = client.post("/api/v1/sessions/current/choices", json={"choice_id": choice("s1", "b")}, headers=auth(token))
    assert ok.status_code == 200


def test_unexpected_engine_exception_returns_500_and_persists_nothing(app, client, seeded):
    def crash(content, state, sid, cid):
        raise KeyError("internal engine detail")

    original = app.extensions[ENGINE_KEY]
    app.extensions[ENGINE_KEY] = EngineAdapter(fake_module("crashing_engine", apply_choice=crash))
    try:
        token = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()["session_token"]
        response = client.post("/api/v1/sessions/current/choices", json={"choice_id": choice("s1", "a")}, headers=auth(token))
    finally:
        app.extensions[ENGINE_KEY] = original
    assert response.status_code == 500
    assert response.get_json()["error"]["code"] == "engine_error"
    assert "internal engine detail" not in response.get_data(as_text=True)
    with app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 0


def test_invalid_presented_scenario_is_an_engine_error(app, client, seeded):
    def bad_present(content, scenario_id, state):
        return {"id": scenario_id, "title": "t", "narrative": "n", "choices": [{"id": "not-in-content", "label": "x"}]}

    original = app.extensions[ENGINE_KEY]
    app.extensions[ENGINE_KEY] = EngineAdapter(fake_module("bad_present_engine", present_scenario=bad_present))
    try:
        response = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"})
    finally:
        app.extensions[ENGINE_KEY] = original
    assert response.status_code == 500
    assert response.get_json()["error"]["code"] == "engine_error"


# --- session / engine identity ---------------------------------------------------------


def test_sessions_are_bound_to_the_engine_that_created_them(client, external_app, seeded):
    token = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()["session_token"]
    other = external_app.test_client()
    for method, path, kwargs in (
        ("get", "/api/v1/sessions/current", {}),
        ("post", "/api/v1/sessions/current/choices", {"json": {"choice_id": choice("s1", "a")}}),
    ):
        response = getattr(other, method)(path, headers=auth(token), **kwargs)
        assert response.status_code == 409, (path, response.get_json())
        assert response.get_json()["error"]["code"] == "session_engine_mismatch"
    with external_app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 0


def test_existing_reports_survive_an_engine_change(client, external_app, seeded):
    token = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()["session_token"]
    for scenario, key in (("s1", "a"), ("s2", "a")):
        client.post("/api/v1/sessions/current/choices", json={"choice_id": choice(scenario, key)}, headers=auth(token))
    created = client.post("/api/v1/sessions/current/report", headers=auth(token)).get_json()
    other = external_app.test_client()
    again = other.post("/api/v1/sessions/current/report", headers=auth(token))
    assert again.status_code == 200 and again.get_json()["report_id"] == created["report_id"]
    assert other.get(f"/api/v1/reports/{created['share_token']}").status_code == 200
    assert other.get("/api/v1/sessions/current", headers=auth(token)).status_code == 200  # completed: no engine call


def test_new_report_for_mismatched_session_is_refused(client, external_app, seeded):
    token = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation"}).get_json()["session_token"]
    for scenario, key in (("s1", "a"), ("s2", "a")):
        client.post("/api/v1/sessions/current/choices", json={"choice_id": choice(scenario, key)}, headers=auth(token))
    response = external_app.test_client().post("/api/v1/sessions/current/report", headers=auth(token))
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "session_engine_mismatch"
    with external_app.app_context():
        assert db.session.execute(select(func.count(FutureprintReport.id))).scalar_one() == 0


def test_readiness_exposes_engine_identity(client, external_app, seeded):
    assert client.get("/api/v1/health/ready").get_json()["engine"] == {"is_reference": True, "version": None}
    assert external_app.test_client().get("/api/v1/health/ready").get_json()["engine"] == {"is_reference": False, "version": "fixture-1"}


def test_engine_receives_versioned_content(app, seeded):
    with app.app_context():
        from app.repositories import content_repository

        occ = content_repository.get_occupation_by_slug("test-occupation")
        content = build_engine_content(occ, content_repository.get_active_content_version())
    assert content["schema_version"] == 1
    assert content["start_scenario_id"] == str(ids.scenario_id("test-occupation", "s1"))


def test_settings_used_by_tests_allow_reference(settings):
    assert settings.app_env == "testing" and settings.reference_engine_allowed is True
