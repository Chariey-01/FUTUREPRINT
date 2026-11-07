"""Report generator: turns a finished session into an explainable report.

``generate_report`` is a pure function of ``content``, the accepted choices and
the final state. It adds no timestamps or random ids (the backend adds
``report_id`` and ``generated_at`` when it stores the snapshot), so calling it
twice returns an identical report.

Every item carries ``origin`` (``user_choice``, ``suggestion`` or
``research``) and ``because``: the rule that produced it and the ids of the
choices that led to it.
"""

from __future__ import annotations

from typing import Any

from app.services.recommendation_engine.rules import recommend
from app.services.scenario_engine.engine import (
    ENGINE_VERSION,
    PATHWAY_ORDER,
    apply_choice,
    choice_signals,
    dominant_pathway,
    find_choice,
    rebuild_state,
    scenario_prompt,
    start_state,
)

REPORT_SCHEMA_VERSION = 1

# Labels for the capability traits shared by every occupation's seed data,
# used when content does not label a tag itself.
DEFAULT_TAG_LABELS = {
    "ai_fluency": "AI fluency",
    "judgement": "Professional judgement",
    "technical_depth": "Technical depth",
    "human_connection": "Human connection",
    "adaptability": "Adaptability",
    "learning_mindset": "Learning mindset",
}


def _because(rule: str, choices: list[str]) -> dict[str, Any]:
    return {"rule": rule, "choices": list(choices)}


def _quote_labels(labels: list[str]) -> str:
    quoted = [f'"{label}"' for label in labels]
    if len(quoted) <= 1:
        return "".join(quoted)
    return ", ".join(quoted[:-1]) + " and " + quoted[-1]


def _ordered_steps(choices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(choices, key=lambda c: c["step_index"])


def _choice_ids_where(content: dict[str, Any], steps: list[dict[str, Any]], test) -> list[str]:
    ids = []
    for step in steps:
        if test(choice_signals(find_choice(content, step["scenario_id"], step["choice_id"]))):
            ids.append(step["choice_id"])
    return ids


def _choice_label(content: dict[str, Any], steps: list[dict[str, Any]], choice_id: str) -> str:
    step = next(s for s in steps if s["choice_id"] == choice_id)
    return find_choice(content, step["scenario_id"], choice_id)["label"]


def _pathway_content(content: dict[str, Any], kind: str) -> dict[str, Any]:
    for pathway in content.get("pathways", []):
        if pathway["kind"] == kind:
            return pathway
    return {"kind": kind, "slug": kind, "title": kind.capitalize(), "summary": "", "steps": [], "skills": []}


def _build_choices_section(content: dict[str, Any], steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    section, state = [], start_state()
    for step in steps:
        scenario = content["scenarios"][step["scenario_id"]]
        choice = find_choice(content, step["scenario_id"], step["choice_id"])
        section.append({
            "step_index": step["step_index"],
            "scenario_id": step["scenario_id"],
            "scenario_title": scenario["title"],
            "prompt": scenario_prompt(content, step["scenario_id"], state),
            "choice_id": choice["id"],
            "choice_label": choice["label"],
            "feedback": choice.get("feedback"),
            "origin": "user_choice",
            "because": _because("user_choice", [choice["id"]]),
        })
        state = apply_choice(content, state, step["scenario_id"], step["choice_id"]).state
    return section


def _tied_with(state: dict[str, Any], kind: str) -> list[str]:
    """Other pathways with the same weight as ``kind``, in the fixed order."""
    weights = state["pathway_weights"]
    return [k for k in PATHWAY_ORDER if k != kind and weights.get(k, 0) == weights.get(kind, 0)]


def _build_pathway_section(content: dict[str, Any], steps: list[dict[str, Any]], state: dict[str, Any], kind: str) -> dict[str, Any]:
    pathway = _pathway_content(content, kind)
    leaning = _choice_ids_where(content, steps, lambda s: s["pathway_weights"][kind] > 0)
    title = pathway["title"]
    tied = _tied_with(state, kind)
    if not leaning:
        reason = f"{title} is shown first because none of your choices favoured another pathway more."
    elif tied:
        labels = [_choice_label(content, steps, cid) for cid in leaning]
        others = " and ".join(_pathway_content(content, k)["title"] for k in tied)
        reason = (
            f"Your choices leaned equally towards {title} and {others}. You chose {_quote_labels(labels)} for "
            f"{title}, and ties are shown in the order Adapt, Transform, Discover."
        )
    else:
        labels = [_choice_label(content, steps, cid) for cid in leaning]
        reason = f"{title} is your leading pathway because you chose {_quote_labels(labels)}."
    return {
        "kind": kind,
        "slug": pathway["slug"],
        "title": title,
        "summary": pathway.get("summary", ""),
        "steps": list(pathway.get("steps", [])),
        "reason": reason,
        "origin": "user_choice",
        "because": _because("dominant_pathway", leaning),
    }


def _build_tag_section(content: dict[str, Any], steps: list[dict[str, Any]], tags: list[str], group: str) -> list[dict[str, Any]]:
    labels = (content.get("tags") or {}).get(group) or {}
    section = []
    for tag in tags:
        meta = labels.get(tag) or {}
        sources = _choice_ids_where(content, steps, lambda s, t=tag: t in s[group])
        choice_labels = [_choice_label(content, steps, cid) for cid in sources]
        section.append({
            "tag": tag,
            "label": meta.get("label") or DEFAULT_TAG_LABELS.get(tag) or tag.replace("_", " ").capitalize(),
            "description": meta.get("description", ""),
            "reason": f"From your choice {_quote_labels(choice_labels)}." if len(sources) == 1
            else f"From your choices {_quote_labels(choice_labels)}.",
            "origin": "user_choice",
            "because": _because(f"choice_signal:{group}", sources),
        })
    return section


def _build_suggestions(suggestions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": s["id"],
            "rule_id": s["rule_id"],
            "category": s["category"],
            "title": s["title"],
            "description": s["description"],
            "reason": s["reason"],
            "evidence_ids": s["evidence_ids"],
            "origin": "suggestion",
            "because": _because(s["rule_id"], s["choices"]),
        }
        for s in suggestions
    ]


def _build_transferable_skills(content: dict[str, Any], pathway: dict[str, Any], leaning: list[str]) -> list[dict[str, Any]]:
    tasks_by_skill: dict[str, list[str]] = {}
    for task in content["occupation"].get("tasks", []):
        for skill in task.get("skills", []):
            tasks_by_skill.setdefault(skill["slug"], []).append(task["title"])
    section = []
    for skill in _pathway_content(content, pathway["kind"]).get("skills", []):
        tasks = tasks_by_skill.get(skill["slug"])
        if not tasks:
            continue
        section.append({
            "slug": skill["slug"],
            "name": skill["name"],
            "reason": f"You already use it in \"{tasks[0]}\", and the {pathway['title']} pathway builds on it.",
            "origin": "suggestion",
            "because": _because("transferable_skill", leaning),
        })
    return section


def _build_research(content: dict[str, Any], suggestions: list[dict[str, Any]], pathway: dict[str, Any], leaning: list[str]) -> list[dict[str, Any]]:
    evidence = content.get("evidence") or {}
    links: list[tuple[str, str, list[str]]] = []
    for s in suggestions:
        links.extend((eid, s["rule_id"], s["because"]["choices"]) for eid in s["evidence_ids"])
    pathway_rule = f"pathway:{pathway['slug']}"
    links.extend((eid, pathway_rule, leaning) for eid in _pathway_content(content, pathway["kind"]).get("evidence_ids", []))

    section, seen = [], set()
    for eid, rule, choices in links:
        record = evidence.get(eid)
        if eid in seen or not record or not record.get("url"):
            continue
        seen.add(eid)
        linked_by = f"the {pathway['title']} pathway" if rule == pathway_rule else "a suggestion in this report"
        section.append({
            "id": eid,
            "statement": record["statement"],
            "source": {
                "title": record["title"],
                "publisher": record.get("publisher", ""),
                "year": record.get("year"),
                "url": record["url"],
            },
            "reason": f"Supports {linked_by}.",
            "origin": "research",
            "because": _because(rule, choices),
        })
    return section


def _build_other_pathways(content: dict[str, Any], steps: list[dict[str, Any]], state: dict[str, Any], leading: str) -> list[dict[str, Any]]:
    weights = state["pathway_weights"]
    others = sorted((k for k in PATHWAY_ORDER if k != leading), key=lambda k: (-weights.get(k, 0), PATHWAY_ORDER.index(k)))
    section = []
    for kind in others:
        pathway = _pathway_content(content, kind)
        leaning = _choice_ids_where(content, steps, lambda s, k=kind: s["pathway_weights"][k] > 0)
        if leaning and weights.get(kind, 0) == weights.get(leading, 0):
            labels = [_choice_label(content, steps, cid) for cid in leaning]
            reason = f"Your choices leaned towards it as much as the leading pathway when you chose {_quote_labels(labels)}."
        elif leaning:
            labels = [_choice_label(content, steps, cid) for cid in leaning]
            reason = f"You touched on it when you chose {_quote_labels(labels)}; try a path that follows it further."
        else:
            reason = "None of your choices followed it, so it is the least explored option. Try it to compare."
        section.append({
            "kind": kind,
            "slug": pathway["slug"],
            "title": pathway["title"],
            "summary": pathway.get("summary", ""),
            "reason": reason,
            "origin": "suggestion",
            "because": _because("other_pathway", leaning),
        })
    return section


def generate_report(
    content: dict[str, Any], occupation_slug: str, choices: list[dict[str, Any]], state: dict[str, Any]
) -> dict[str, Any]:
    occupation = content["occupation"]
    if occupation["slug"] != occupation_slug:
        raise ValueError(f"content is for {occupation['slug']!r}, not {occupation_slug!r}")
    steps = _ordered_steps(choices)
    # Replay the accepted choices so every tag and weight is attributable to a
    # choice in this content, even if the stored state came from an older edit.
    state = rebuild_state(content, steps)
    leading = dominant_pathway(state)
    pathway = _build_pathway_section(content, steps, state, leading)
    suggestions = _build_suggestions(recommend(content, state))
    return {
        "schema_version": REPORT_SCHEMA_VERSION,
        "engine_version": ENGINE_VERSION,
        "content_version": content.get("content_version"),
        "occupation": {"slug": occupation["slug"], "name": occupation["name"], "origin": "user_choice"},
        "choices": _build_choices_section(content, steps),
        "pathway": pathway,
        "capabilities": _build_tag_section(content, steps, state["capabilities"], "capabilities"),
        "trade_offs": _build_tag_section(content, steps, state["trade_offs"], "trade_offs"),
        "suggestions": suggestions,
        "transferable_skills": _build_transferable_skills(content, pathway, pathway["because"]["choices"]),
        "research": _build_research(content, suggestions, pathway, pathway["because"]["choices"]),
        "other_pathways": _build_other_pathways(content, steps, state, leading),
    }
