import threading

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.extensions import db
from app.models import FutureprintReport
from app.seed import ids
from app.security import sha256_hex
from tests.conftest import auth


def complete_session(client, token):
    for scenario, key in (("s1", "a"), ("s2", "a")):
        response = client.post(
            "/api/v1/sessions/current/choices",
            json={"choice_id": str(ids.choice_id("test-occupation", scenario, key))},
            headers=auth(token),
        )
        assert response.status_code == 200


def create_report(client, token, **kwargs):
    return client.post("/api/v1/sessions/current/report", headers=auth(token), **kwargs)


def test_report_requires_completed_session(client, new_session):
    token, _ = new_session()
    response = create_report(client, token)
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "session_not_completed"


def test_report_generation_is_idempotent(app, client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    first = create_report(client, token)
    assert first.status_code == 201
    first_body = first.get_json()
    second = create_report(client, token)
    assert second.status_code == 200
    second_body = second.get_json()
    assert second_body["created"] is False
    assert second_body["report_id"] == first_body["report_id"]
    assert second_body["share_token"] == first_body["share_token"]
    assert second_body["report"] == first_body["report"]
    with app.app_context():
        assert db.session.execute(select(func.count(FutureprintReport.id))).scalar_one() == 1


def test_report_snapshot_contents(client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    report = create_report(client, token).get_json()["report"]
    assert report["schema_version"] == 1
    assert report["occupation"]["slug"] == "test-occupation"
    assert [step["choice_label"] for step in report["journey"]] == ["Adapt", "Finish"]
    assert report["insights"]["pathway_affinity"] == {"adapt": 2, "transform": 0, "discover": 0}
    assert report["insights"]["leading_pathway_kind"] == "adapt"
    assert report["insights"]["recommended_pathways"][0]["kind"] == "adapt"
    assert {e["key"] for e in report["evidence"]} == {"test-source", "kenya-source"}
    assert "not a prediction" in report["disclaimer"]


def test_shared_report_is_read_only_and_does_not_expose_session(app, client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    created = create_report(client, token).get_json()
    share_token = created["share_token"]
    assert share_token != token and token not in created["share_path"]
    response = client.get(f"/api/v1/reports/{share_token}")
    assert response.status_code == 200
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "no-store" in response.headers["Cache-Control"]
    body = response.get_json()
    assert body["report"] == created["report"]
    assert token not in response.get_data(as_text=True)
    assert "session" not in body
    assert client.post(f"/api/v1/reports/{share_token}").status_code == 405
    with app.app_context():
        row = db.session.execute(select(FutureprintReport)).scalar_one()
        assert row.share_token_hash == sha256_hex(share_token)
        assert share_token not in str(row.snapshot)


def test_share_token_security(client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    share_token = create_report(client, token).get_json()["share_token"]
    assert client.get("/api/v1/reports/" + "A" * 43).status_code == 404
    assert client.get("/api/v1/reports/short").status_code == 404
    assert client.get(f"/api/v1/reports/{token}").status_code == 404  # session token is not a share token
    tampered = ("B" if share_token[0] != "B" else "C") + share_token[1:]
    assert client.get(f"/api/v1/reports/{tampered}").status_code == 404


def test_report_rejects_request_fields(client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    response = create_report(client, token, json={"choices": ["fake"]})
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "unexpected_fields"
    assert create_report(client, token, json={}).status_code == 201


def test_report_rows_are_immutable_in_the_database(app, client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    create_report(client, token)
    with app.app_context():
        with pytest.raises(DBAPIError, match="immutable"):
            db.session.execute(text("UPDATE futureprint_reports SET snapshot = '{}'::jsonb"))
        db.session.rollback()


def test_concurrent_report_requests_create_one_report(app, client, new_session):
    token, _ = new_session()
    complete_session(client, token)
    barrier = threading.Barrier(3)
    results: list[tuple[int, str]] = []
    lock = threading.Lock()

    def worker():
        local = app.test_client()
        barrier.wait()
        response = create_report(local, token)
        with lock:
            results.append((response.status_code, response.get_json()["report_id"]))

    threads = [threading.Thread(target=worker) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert sorted(code for code, _ in results) == [200, 200, 201]
    assert len({rid for _, rid in results}) == 1
    with app.app_context():
        assert db.session.execute(select(func.count(FutureprintReport.id))).scalar_one() == 1
