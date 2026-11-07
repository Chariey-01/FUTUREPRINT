"""Unit tests for the rule grammar and output ordering, on the real software-developer seed."""

from __future__ import annotations

import copy

import pytest

from app.services.recommendation_engine.default_rules import DEFAULT_RULES
from app.services.recommendation_engine.rules import InvalidRuleError, recommend
from app.services.scenario_engine.engine import apply_choice, start_state
from tests.simulator.conftest import final_state, load_real_content

BASE = load_real_content("software-developer")
EVIDENCE = {"ev-1": {"id": "ev-1", "title": "t", "publisher": "p", "url": "https://example.org/ev-1", "statement": "s"}}

# The seed's choices carry no trade-offs, so one is added here to exercise trade-off tags.
CONTENT = copy.deepcopy(BASE)
CONTENT["scenarios"]["dev-1"]["choices"][0]["trade_offs"] = ["speed_vs_quality"]
CONTENT["evidence"] = EVIDENCE

# Adapt path: capabilities ai_fluency, judgement, technical_depth; trade-off speed_vs_quality.
STATE = final_state(CONTENT, ("dev-1-a", "dev-2-a", "dev-3-a"))


def _content_with_rules(*rules):
    content = copy.deepcopy(CONTENT)
    content["rules"] = list(rules)
    return content


def _rule(rule_id, when, priority=10, category="learning_activity", evidence_ids=()):
    return {
        "id": rule_id, "priority": priority, "when": when,
        "output": {"category": category, "title": rule_id, "description": ""},
        "reason": f"because {rule_id}", "evidence_ids": list(evidence_ids),
    }


@pytest.mark.parametrize(
    ("when", "fires"),
    [
        ({"tag": "ai_fluency"}, True),
        ({"tag": "speed_vs_quality"}, True),  # trade-off tags count too
        ({"tag": "human_connection"}, False),
        ({"pathway": "adapt"}, True),
        ({"pathway": "transform"}, False),
        ({"choice": "dev-2-a"}, True),
        ({"choice": "dev-1-b"}, False),
        ({"all": [{"tag": "ai_fluency"}, {"pathway": "adapt"}]}, True),
        ({"all": [{"tag": "ai_fluency"}, {"pathway": "discover"}]}, False),
        ({"any": [{"tag": "human_connection"}, {"choice": "dev-3-a"}]}, True),
        ({"any": [{"tag": "human_connection"}, {"pathway": "discover"}]}, False),
    ],
)
def test_condition_grammar(when, fires):
    outputs = recommend(_content_with_rules(_rule("r", when)), STATE)
    assert bool(outputs) is fires


def test_unsupported_condition_raises():
    with pytest.raises(InvalidRuleError):
        recommend(_content_with_rules(_rule("r", {"score_above": 3})), STATE)


@pytest.mark.parametrize(
    "when",
    [{"all": []}, {"any": "ab"}, {"pathway": "Adapt"}, {"tag": ""}, {"tag": "a", "pathway": "adapt"}, "tag"],
)
def test_malformed_rules_are_rejected_even_when_unreached(when):
    content = _content_with_rules(_rule("ok", {"pathway": "adapt"}), _rule("bad", {"any": [{"tag": "x"}, when]}))
    with pytest.raises(InvalidRuleError):
        recommend(content, STATE)


def test_outputs_sorted_by_priority_then_id():
    content = _content_with_rules(
        _rule("b", {"pathway": "adapt"}, priority=5),
        _rule("a", {"pathway": "adapt"}, priority=5),
        _rule("c", {"pathway": "adapt"}, priority=1),
    )
    assert [o["rule_id"] for o in recommend(content, STATE)] == ["c", "a", "b"]


def test_output_carries_reason_rule_id_evidence_and_choices():
    content = _content_with_rules(_rule("r", {"tag": "ai_fluency"}, category="skill", evidence_ids=["ev-1"]))
    (output,) = recommend(content, STATE)
    assert output["reason"] == "because r"
    assert output["rule_id"] == "r"
    assert output["evidence_ids"] == ["ev-1"]
    assert output["choices"] == ["dev-1-a"]
    assert not any(isinstance(v, float) for v in output.values())


def test_rule_without_evidence_may_only_output_learning_activity():
    content = _content_with_rules(
        _rule("claim", {"pathway": "adapt"}, category="career_direction"),
        _rule("claim-bad-link", {"pathway": "adapt"}, category="skill", evidence_ids=["missing"]),
        _rule("activity", {"pathway": "adapt"}, category="learning_activity"),
    )
    assert [o["rule_id"] for o in recommend(content, STATE)] == ["activity"]


def test_evidence_without_url_does_not_support_a_claim():
    content = _content_with_rules(_rule("claim", {"pathway": "adapt"}, category="skill", evidence_ids=["no-url"]))
    content["evidence"]["no-url"] = {"id": "no-url", "title": "t", "statement": "s"}
    assert recommend(content, STATE) == []


def test_default_rules_used_when_content_has_none():
    state = apply_choice(BASE, start_state(), "dev-1", "dev-1-c").state  # discover; technical_depth, judgement
    outputs = recommend(BASE, state)
    assert [o["rule_id"] for o in outputs] == [
        "default-discover-explore", "default-judgement", "default-technical-depth",
    ]
    assert all(rule["output"]["category"] == "learning_activity" for rule in DEFAULT_RULES)
