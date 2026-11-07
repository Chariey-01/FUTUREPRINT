from app import create_app
from app.config import load_settings
from tests.conftest import TEST_SECRET


def test_health_reports_database_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok" and body["database"] == "ok"
    assert set(body) == {"status", "version", "database"}


def test_readiness_requires_loaded_content(client):
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    assert response.get_json()["checks"] == {"database": "ok", "migrations": "ok", "content": "not_loaded"}


def test_readiness_ok_after_seeding(client, seeded):
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ready"


def test_health_degrades_without_leaking_configuration():
    settings = load_settings(
        env={}, app_env="testing", database_url="postgresql://secretuser:secretpass@127.0.0.1:1/x_test",
        secret_key=TEST_SECRET, log_level="ERROR", log_format="text",
    )
    client = create_app(settings).test_client()
    response = client.get("/api/v1/health")
    assert response.status_code == 503
    text = response.get_data(as_text=True)
    assert "secretpass" not in text and "secretuser" not in text and "127.0.0.1" not in text
    assert response.get_json()["database"] == "unavailable"


def test_unknown_route_returns_json_404(client):
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"


def test_wrong_method_returns_json_405(client):
    response = client.delete("/api/v1/health")
    assert response.status_code == 405
    assert response.get_json()["error"]["code"] == "method_not_allowed"


def test_request_id_is_echoed_or_generated(client):
    assert client.get("/api/v1/health", headers={"X-Request-ID": "abc12345-req"}).headers["X-Request-ID"] == "abc12345-req"
    generated = client.get("/api/v1/health", headers={"X-Request-ID": "bad id!"}).headers["X-Request-ID"]
    assert generated != "bad id!" and len(generated) == 32


def test_unexpected_errors_are_generic(settings):
    app = create_app(settings)

    @app.get("/api/v1/_boom")
    def boom():  # pragma: no cover - exercised via request
        raise RuntimeError("database password is hunter2")

    response = app.test_client().get("/api/v1/_boom")
    assert response.status_code == 500
    body = response.get_json()
    assert body["error"]["code"] == "internal_error"
    assert "hunter2" not in response.get_data(as_text=True)


def test_cors_allows_configured_origin_only(client):
    ok = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    blocked = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in blocked.headers


def test_oversized_body_rejected(client):
    response = client.post("/api/v1/sessions", data="x" * (70 * 1024), content_type="application/json")
    assert response.status_code == 413
    assert response.get_json()["error"]["code"] == "request_entity_too_large"
