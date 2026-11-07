from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.extensions import db
from app.models import AnonymousSession
from app.security import sha256_hex
from tests.conftest import auth


def test_create_session_returns_token_once_and_stores_only_hash(app, new_session):
    token, body = new_session()
    assert token.startswith("fps_") and len(token) == 47
    assert body["token_type"] == "Bearer"
    session = body["session"]
    assert session["status"] == "active"
    assert session["step_count"] == 0
    assert session["occupation"]["slug"] == "test-occupation"
    assert session["current_scenario"]["title"] == "Scenario one"
    assert session["engine"]["is_reference"] is True
    # Effects and transitions are server-side only.
    choice = session["current_scenario"]["choices"][0]
    assert set(choice) == {"id", "label", "description"}
    with app.app_context():
        row = db.session.execute(select(AnonymousSession)).scalar_one()
        assert row.token_hash == sha256_hex(token)
        assert token not in str(row.__dict__)


def test_session_endpoints_are_not_cacheable(client, new_session):
    token, _ = new_session()
    assert client.get("/api/v1/sessions/current", headers=auth(token)).headers["Cache-Control"] == "no-store"


def test_create_session_validation(client, seeded):
    assert client.post("/api/v1/sessions", json={"occupation_slug": "missing"}).status_code == 404
    extra = client.post("/api/v1/sessions", json={"occupation_slug": "test-occupation", "admin": True})
    assert extra.status_code == 422
    assert extra.get_json()["error"]["details"][0]["type"] == "extra_forbidden"
    assert client.post("/api/v1/sessions", json={"occupation_slug": "Bad Slug"}).status_code == 422
    assert client.post("/api/v1/sessions", json=["test-occupation"]).status_code == 422
    assert client.post("/api/v1/sessions", data="occupation_slug=x").status_code == 415
    assert client.post("/api/v1/sessions", data="{not json", content_type="application/json").status_code == 400


def test_get_current_session_resumes_state(client, new_session):
    token, created = new_session()
    first = client.get("/api/v1/sessions/current", headers=auth(token)).get_json()["session"]
    second = client.get("/api/v1/sessions/current", headers=auth(token)).get_json()["session"]
    assert first == second
    assert first["current_scenario"]["id"] == created["session"]["current_scenario"]["id"]


def test_missing_and_invalid_tokens_are_rejected(client, new_session):
    new_session()
    missing = client.get("/api/v1/sessions/current")
    assert missing.status_code == 401
    assert missing.headers["WWW-Authenticate"].startswith("Bearer")
    assert missing.get_json()["error"]["code"] == "invalid_token"
    for header in ("Bearer nonsense", "Basic dXNlcjpwYXNz", "Bearer fps_" + "A" * 43, "fps_" + "A" * 43):
        assert client.get("/api/v1/sessions/current", headers={"Authorization": header}).status_code == 401


def test_expired_session_is_rejected(app, client, new_session):
    token, _ = new_session()
    with app.app_context():
        row = db.session.execute(select(AnonymousSession)).scalar_one()
        row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db.session.commit()
    response = client.get("/api/v1/sessions/current", headers=auth(token))
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "session_expired"


def test_tokens_are_unique_per_session(new_session):
    first, _ = new_session()
    second, _ = new_session()
    assert first != second
