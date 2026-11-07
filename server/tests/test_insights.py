import json

import pytest
from pydantic import SecretStr
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import AIUsageRecord
from app.services import insights_service
from app.services.insights_service import GATEWAY_KEY, GatewayResult
from tests.conftest import auth


class FakeGateway:
    def __init__(self, text=None, error=None):
        self.calls = 0
        self.text = text
        self.error = error
        self.last_user = None

    def complete(self, *, model, system, user, max_output_tokens):
        self.calls += 1
        self.last_user = user
        if self.error:
            raise self.error
        return GatewayResult(text=self.text, input_tokens=1000, output_tokens=200)


GOOD_ANSWER = json.dumps(
    {
        "answer": "Exposure means tasks could change, not that the job disappears.",
        "evidence_sufficient": True,
        "cited_source_keys": ["test-source", "invented-source"],
        "limitations": "Global evidence.",
    }
)


@pytest.fixture
def ai_app(settings):
    enabled = settings.model_copy(
        update={
            "ai_insights_enabled": True,
            "openai_api_key": SecretStr("sk-test-not-real"),
            "openai_model": "test-model",
            "ai_max_requests_per_session": 2,
            "ai_max_question_chars": 100,
            "ai_input_cost_per_1m_tokens": 1.0,
            "ai_output_cost_per_1m_tokens": 4.0,
        }
    )
    app = create_app(enabled)
    insights_service.CACHE.clear()
    yield app
    insights_service.CACHE.clear()


def session_token(client, occupation="test-occupation"):
    return client.post("/api/v1/sessions", json={"occupation_slug": occupation}).get_json()["session_token"]


def test_disabled_by_default(client, seeded):
    assert client.get("/api/v1/insights/status").get_json()["enabled"] is False
    token = session_token(client)
    response = client.post("/api/v1/insights/explain", json={"occupation_slug": "test-occupation"}, headers=auth(token))
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "ai_insights_disabled"


def test_explain_requires_session(client, seeded):
    assert client.post("/api/v1/insights/explain", json={"occupation_slug": "test-occupation"}).status_code == 401


def test_grounded_answer_filters_citations_and_records_usage(ai_app, seeded):
    gateway = FakeGateway(text=GOOD_ANSWER)
    ai_app.extensions[GATEWAY_KEY] = gateway
    client = ai_app.test_client()
    token = session_token(client)
    response = client.post(
        "/api/v1/insights/explain",
        json={"occupation_slug": "test-occupation", "task_slug": "task-one", "question": "Will AI take this job?"},
        headers=auth(token),
    )
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert [c["key"] for c in body["citations"]] == ["test-source"]  # invented key dropped
    assert body["usage"] == {"input_tokens": 1000, "output_tokens": 200, "estimated_cost_usd": 0.0018}
    assert body["cached"] is False
    assert "[test-source]" in gateway.last_user and "Task one" in gateway.last_user
    with ai_app.app_context():
        record = db.session.execute(select(AIUsageRecord)).scalar_one()
        assert record.status == "success" and record.input_tokens == 1000


def test_identical_questions_are_cached(ai_app, seeded):
    gateway = FakeGateway(text=GOOD_ANSWER)
    ai_app.extensions[GATEWAY_KEY] = gateway
    client = ai_app.test_client()
    token = session_token(client)
    payload = {"occupation_slug": "test-occupation", "question": "What changes?"}
    client.post("/api/v1/insights/explain", json=payload, headers=auth(token))
    second = client.post("/api/v1/insights/explain", json=payload, headers=auth(token)).get_json()
    assert second["cached"] is True and gateway.calls == 1


def test_gateway_errors_are_handled(ai_app, seeded):
    ai_app.extensions[GATEWAY_KEY] = FakeGateway(error=TimeoutError("slow"))
    client = ai_app.test_client()
    token = session_token(client)
    response = client.post("/api/v1/insights/explain", json={"occupation_slug": "test-occupation"}, headers=auth(token))
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "ai_unavailable"
    assert "slow" not in response.get_data(as_text=True)
    with ai_app.app_context():
        assert db.session.execute(select(AIUsageRecord.status)).scalar_one() == "error"


def test_invalid_model_output_is_rejected(ai_app, seeded):
    ai_app.extensions[GATEWAY_KEY] = FakeGateway(text="not json")
    client = ai_app.test_client()
    token = session_token(client)
    response = client.post("/api/v1/insights/explain", json={"occupation_slug": "test-occupation"}, headers=auth(token))
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "ai_invalid_response"


def test_limits_quota_and_unknown_task(ai_app, seeded):
    ai_app.extensions[GATEWAY_KEY] = FakeGateway(text=GOOD_ANSWER)
    client = ai_app.test_client()
    token = session_token(client)
    too_long = client.post(
        "/api/v1/insights/explain", json={"occupation_slug": "test-occupation", "question": "x" * 101}, headers=auth(token)
    )
    assert too_long.status_code == 422 and too_long.get_json()["error"]["code"] == "question_too_long"
    unknown = client.post(
        "/api/v1/insights/explain", json={"occupation_slug": "test-occupation", "task_slug": "nope"}, headers=auth(token)
    )
    assert unknown.status_code == 404
    for q in ("first question", "second question"):
        assert client.post("/api/v1/insights/explain", json={"occupation_slug": "test-occupation", "question": q}, headers=auth(token)).status_code == 200
    limited = client.post(
        "/api/v1/insights/explain", json={"occupation_slug": "test-occupation", "question": "third question"}, headers=auth(token)
    )
    assert limited.status_code == 429
