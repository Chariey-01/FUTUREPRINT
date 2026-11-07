"""Recommendation engine: rules are data, not code (PRD section 13).

A rule is a dict::

    {"id": "dev-r-review", "priority": 10,
     "when": {"all": [{"tag": "ai_tooling"}, {"pathway": "adapt"}]},
     "output": {"category": "skill", "title": "...", "description": "..."},
     "reason": "You chose to review AI code instead of trusting it.",
     "evidence_ids": ["copilot-study"]}

Conditions support this grammar and nothing more:

* ``{"tag": t}``: ``t`` is in the state's capabilities or trade-offs;
* ``{"pathway": p}``: ``p`` is the dominant pathway;
* ``{"choice": c}``: choice ``c`` is in the history;
* ``{"all": [...]}`` / ``{"any": [...]}``: all / any nested conditions hold.

A rule whose evidence ids do not resolve to evidence in ``content`` may only
output a learning activity, never a research-backed claim; other such rules
are skipped. Outputs are sorted by priority, then rule id. No scores are
returned.
"""

from __future__ import annotations

from typing import Any

from app.services.recommendation_engine.default_rules import DEFAULT_RULES
from app.services.scenario_engine.engine import PATHWAY_ORDER, choice_signals, dominant_pathway, find_choice

UNSUPPORTED_WITHOUT_EVIDENCE = "learning_activity"


class InvalidRuleError(ValueError):
    """A rule condition uses something outside the supported grammar."""


def validate_condition(condition: Any) -> None:
    """Raise InvalidRuleError unless ``condition`` fits the grammar exactly."""
    if not isinstance(condition, dict) or len(condition) != 1:
        raise InvalidRuleError(f"a condition must be a dict with exactly one key: {condition!r}")
    (op, value), = condition.items()
    if op in ("tag", "choice"):
        if not isinstance(value, str) or not value:
            raise InvalidRuleError(f"{op!r} needs a non-empty string: {condition!r}")
    elif op == "pathway":
        if value not in PATHWAY_ORDER:
            raise InvalidRuleError(f"unknown pathway {value!r}")
    elif op in ("all", "any"):
        if not isinstance(value, list) or not value:
            raise InvalidRuleError(f"{op!r} needs a non-empty list: {condition!r}")
        for nested in value:
            validate_condition(nested)
    else:
        raise InvalidRuleError(f"unsupported condition {op!r}")


def _contributing_choices(content: dict[str, Any], state: dict[str, Any], test) -> list[str]:
    """Choice ids in history whose signals satisfy ``test``, in history order."""
    found = []
    for step in state["history"]:
        signals = choice_signals(find_choice(content, step["scenario_id"], step["choice_id"]))
        if test(signals) and step["choice_id"] not in found:
            found.append(step["choice_id"])
    return found


def _evaluate_condition(content: dict[str, Any], state: dict[str, Any], condition: dict[str, Any]) -> tuple[bool, list[str]]:
    """Return (holds, choice ids that made it hold)."""
    (op, value), = condition.items()
    if op == "tag":
        holds = value in state["capabilities"] or value in state["trade_offs"]
        test = lambda s: value in s["capabilities"] or value in s["trade_offs"]  # noqa: E731
        return holds, _contributing_choices(content, state, test) if holds else []
    if op == "pathway":
        holds = dominant_pathway(state) == value
        test = lambda s: s["pathway_weights"].get(value, 0) > 0  # noqa: E731
        return holds, _contributing_choices(content, state, test) if holds else []
    if op == "choice":
        holds = any(step["choice_id"] == value for step in state["history"])
        return holds, [value] if holds else []
    if op in ("all", "any"):
        results = [_evaluate_condition(content, state, nested) for nested in value]
        holds = all(r[0] for r in results) if op == "all" else any(r[0] for r in results)
        choices: list[str] = []
        for ok, ids in results:
            choices.extend(i for i in ids if ok and i not in choices)
        return holds, choices if holds else []
    raise InvalidRuleError(f"unsupported condition {op!r}")


def _known_evidence(content: dict[str, Any], rule: dict[str, Any]) -> list[str]:
    evidence = content.get("evidence") or {}
    # Evidence without a source URL cannot be cited, so it does not count as support.
    return [eid for eid in rule.get("evidence_ids", []) if (evidence.get(eid) or {}).get("url")]


def _is_allowed(rule: dict[str, Any], evidence_ids: list[str]) -> bool:
    return bool(evidence_ids) or rule["output"]["category"] == UNSUPPORTED_WITHOUT_EVIDENCE


def _to_output(rule: dict[str, Any], evidence_ids: list[str], choices: list[str]) -> dict[str, Any]:
    output = rule["output"]
    return {
        "id": rule["id"],
        "rule_id": rule["id"],
        "priority": int(rule.get("priority", 100)),
        "category": output["category"],
        "title": output["title"],
        "description": output.get("description", ""),
        "reason": rule["reason"],
        "evidence_ids": evidence_ids,
        "choices": choices,
    }


def active_rules(content: dict[str, Any]) -> list[dict[str, Any]]:
    """The occupation's rules from content, or the generic defaults when it has none."""
    return content.get("rules") or DEFAULT_RULES


def recommend(content: dict[str, Any], state: dict[str, Any]) -> list[dict[str, Any]]:
    rules = active_rules(content)
    for rule in rules:  # check every rule up front, not only the branches a path reaches
        validate_condition(rule["when"])
    outputs = []
    for rule in rules:
        evidence_ids = _known_evidence(content, rule)
        if not _is_allowed(rule, evidence_ids):
            continue
        holds, choices = _evaluate_condition(content, state, rule["when"])
        if holds:
            outputs.append(_to_output(rule, evidence_ids, choices))
    return sorted(outputs, key=lambda o: (o["priority"], o["rule_id"]))
