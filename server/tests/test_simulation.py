import threading
import types
import uuid

from sqlalchemy import func, select, text

from app import ENGINE_KEY
from app.engine import reference
from app.engine.adapter import EngineAdapter
from app.extensions import db
from app.models import AnonymousSession, UserChoice
from app.seed import ids
from tests.conftest import auth


def choice(scenario: str, key: str, occupation: str = "test-occupation") -> str:
    return str(ids.choice_id(occupation, scenario, key))


def submit(client, token, choice_id, **extra):
    return client.post("/api/v1/sessions/current/choices", json={"choice_id": choice_id, **extra}, headers=auth(token))


def test_valid_choice_advances_session_and_persists(app, client, new_session):
    token, _ = new_session()
    response = submit(client, token, choice("s1", "a"))
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["accepted_choice"]["step_index"] == 1
    assert body["accepted_choice"]["feedback"] == "Fixture feedback A."
    assert body["completed"] is False
    session = body["session"]
    assert session["current_scenario"]["id"] == str(ids.scenario_id("test-occupation", "s2"))
    assert session["state"]["pathway_affinity"]["adapt"] == 1
    assert session["state"]["traits"] == {"ai_fluency": 2}
    assert [h["choice"]["label"] for h in session["history"]] == ["Adapt"]
    resumed = client.get("/api/v1/sessions/current", headers=auth(token)).get_json()["session"]
    assert resumed["current_scenario"]["id"] == session["current_scenario"]["id"]


def test_full_path_completes_and_rejects_further_choices(client, new_session):
    token, _ = new_session()
    assert submit(client, token, choice("s1", "c")).status_code == 200
    final = submit(client, token, choice("s3", "a"))
    assert final.status_code == 200
    body = final.get_json()
    assert body["completed"] is True
    assert body["session"]["status"] == "completed"
    assert body["session"]["current_scenario"] is None
    assert body["session"]["completed_at"] is not None
    late = submit(client, token, choice("s3", "b"))
    assert late.status_code == 409
    assert late.get_json()["error"]["code"] == "session_completed"


def test_choice_must_belong_to_current_scenario(client, new_session):
    token, _ = new_session()
    for bad in (choice("s2", "a"), choice("o1", "a", "other-occupation"), str(uuid.uuid4())):
        response = submit(client, token, bad)
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "invalid_choice"


def test_client_cannot_supply_scenario_or_malformed_choice(client, new_session):
    token, _ = new_session()
    spoof = submit(client, token, choice("s1", "a"), scenario_id=str(ids.scenario_id("test-occupation", "s3")))
    assert spoof.status_code == 422
    assert spoof.get_json()["error"]["details"][0]["field"] == "scenario_id"
    assert submit(client, token, "not-a-uuid").status_code == 422
    assert client.post("/api/v1/sessions/current/choices", json={}, headers=auth(token)).status_code == 422


def test_duplicate_submission_is_rejected(app, client, new_session):
    token, _ = new_session()
    assert submit(client, token, choice("s1", "a")).status_code == 200
    again = submit(client, token, choice("s1", "a"))
    assert again.status_code == 409
    assert again.get_json()["error"]["code"] == "duplicate_choice"
    with app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 1


def test_choice_requires_authentication(client, seeded):
    assert submit(client, "fps_" + "x" * 43, choice("s1", "a")).status_code == 401


def test_concurrent_duplicate_submissions_record_only_one_choice(app, client, new_session):
    token, _ = new_session()
    barrier = threading.Barrier(4)
    statuses: list[int] = []
    lock = threading.Lock()

    def worker():
        local_client = app.test_client()
        barrier.wait()
        response = submit(local_client, token, choice("s1", "b"))
        with lock:
            statuses.append(response.status_code)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert sorted(statuses) == [200, 409, 409, 409]
    with app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 1
        row = db.session.execute(select(AnonymousSession)).scalar_one()
        assert row.step_count == 1


def test_session_row_is_locked_during_choice_processing(app, client, new_session):
    token, _ = new_session()
    with app.app_context():
        session_id = db.session.execute(select(AnonymousSession.id)).scalar_one()
        db.session.remove()
        conn = db.engine.connect()
        tx = conn.begin()
        conn.execute(text("SELECT id FROM anonymous_sessions WHERE id = :id FOR UPDATE"), {"id": session_id})
        result: dict[str, int] = {}

        def worker():
            result["status"] = submit(app.test_client(), token, choice("s1", "a")).status_code

        thread = threading.Thread(target=worker)
        thread.start()
        thread.join(timeout=1.0)
        assert thread.is_alive(), "request should block while another transaction holds the row lock"
        tx.rollback()
        conn.close()
        thread.join(timeout=10)
        assert result["status"] == 200


def test_engine_contract_violation_returns_500_without_persisting(app, client, new_session):
    token, _ = new_session()
    broken = types.ModuleType("broken_engine")
    broken.start_state = reference.start_state
    broken.present_scenario = reference.present_scenario
    broken.generate_report = reference.generate_report
    broken.apply_choice = lambda content, state, sid, cid: {"state": state, "completed": False, "next_scenario_id": str(uuid.uuid4())}
    original = app.extensions[ENGINE_KEY]
    app.extensions[ENGINE_KEY] = EngineAdapter(broken, is_reference=False)
    try:
        response = submit(client, token, choice("s1", "a"))
    finally:
        app.extensions[ENGINE_KEY] = original
    assert response.status_code == 500
    assert response.get_json()["error"]["code"] == "engine_error"
    with app.app_context():
        assert db.session.execute(select(func.count(UserChoice.id))).scalar_one() == 0
        assert db.session.execute(select(AnonymousSession.step_count)).scalar_one() == 0
