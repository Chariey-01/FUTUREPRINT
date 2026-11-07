"""Path, determinism and report-shape tests (PRD section 19: identical choices give identical reports).

Every path of every occupation in ``seed_data`` is played through the engine.
"""

from __future__ import annotations

import importlib
import json

import pytest

from app.engine.adapter import EngineAdapter, check_signatures
from app.engine.conformance import check_engine
from app.services.report_generator.generator import generate_report
from app.services.scenario_engine.engine import dominant_pathway
from tests.simulator.conftest import all_paths, final_state, load_real_content, load_research_content, run

OCCUPATIONS = (
    "customer-service-agent", "accountant", "software-developer",
    "secondary-school-teacher", "graphic-designer", "registered-nurse",
)
CONTENTS = {slug: load_real_content(slug) for slug in OCCUPATIONS}
CASES = [(slug, path) for slug in OCCUPATIONS for path in all_paths(CONTENTS[slug])]
REPORT_KEYS = {
    "schema_version", "engine_version", "content_version", "occupation", "choices", "pathway",
    "capabilities", "trade_offs", "suggestions", "transferable_skills", "research", "other_pathways",
}


def _without_choices(report: dict) -> str:
    return json.dumps({k: v for k, v in report.items() if k != "choices"}, sort_keys=True)


def _items(report: dict):
    yield report["pathway"]
    for key in ("choices", "capabilities", "trade_offs", "suggestions", "transferable_skills", "research", "other_pathways"):
        yield from report[key]


def _choices(content: dict, path: tuple[str, ...]) -> list[dict]:
    steps, scenario_id = [], content["start_scenario_id"]
    for index, choice_id in enumerate(path, start=1):
        steps.append({"step_index": index, "scenario_id": scenario_id, "choice_id": choice_id})
        choice = next(c for c in content["scenarios"][scenario_id]["choices"] if c["id"] == choice_id)
        scenario_id = choice["next_scenario_id"]
    return steps


@pytest.mark.parametrize("slug", OCCUPATIONS)
def test_every_occupation_has_27_paths(slug):
    assert len(all_paths(CONTENTS[slug])) == 27


@pytest.mark.parametrize(("slug", "path"), CASES)
def test_every_path_reaches_a_report(slug, path):
    report = run(CONTENTS[slug], path)
    assert set(report) == REPORT_KEYS
    assert [c["choice_id"] for c in report["choices"]] == list(path)
    assert report["occupation"]["slug"] == slug
    assert report["content_version"] == CONTENTS[slug]["content_version"]
    assert len(report["other_pathways"]) == 2
    assert report["pathway"]["kind"] not in {p["kind"] for p in report["other_pathways"]}


@pytest.mark.parametrize(("slug", "path"), CASES)
def test_same_choices_same_report(slug, path):
    assert run(CONTENTS[slug], path) == run(CONTENTS[slug], path)


@pytest.mark.parametrize(("slug", "path"), CASES)
def test_every_item_explains_why_it_appeared(slug, path):
    report = run(CONTENTS[slug], path)
    for item in _items(report):
        assert item["origin"] in {"user_choice", "suggestion", "research"}
        assert item["because"]["rule"]
        assert set(item["because"]["choices"]) <= set(path)
    for item in [report["pathway"], *report["capabilities"], *report["trade_offs"], *report["other_pathways"]]:
        assert item["reason"]
    for item in report["capabilities"]:
        assert item["because"]["choices"], "every capability names the choice that produced it"


@pytest.mark.parametrize(("slug", "path"), CASES)
def test_every_suggestion_has_reason_and_rule(slug, path):
    report = run(CONTENTS[slug], path)
    assert report["suggestions"], "default rules give every path at least one suggestion"
    for suggestion in report["suggestions"]:
        assert suggestion["reason"].strip()
        assert suggestion["rule_id"]
        assert suggestion["category"] == "learning_activity" or suggestion["evidence_ids"]


@pytest.mark.parametrize(("slug", "path"), CASES)
def test_report_has_no_scores_or_probabilities(slug, path):
    report = run(CONTENTS[slug], path)
    text = json.dumps(report)
    assert "%" not in text
    assert "guarantee" not in text.lower()

    def walk(value):
        assert not isinstance(value, float)
        if isinstance(value, dict):
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)

    walk(report)


@pytest.mark.parametrize("slug", OCCUPATIONS)
def test_each_pathway_leads_at_least_one_path(slug):
    content = CONTENTS[slug]
    leaders = {dominant_pathway(final_state(content, path)) for path in all_paths(content)}
    assert leaders == {"adapt", "transform", "discover"}


@pytest.mark.parametrize("slug", OCCUPATIONS)
def test_at_least_20_of_27_reports_differ_beyond_the_choices_list(slug):
    content = CONTENTS[slug]
    assert len({_without_choices(run(content, path)) for path in all_paths(content)}) >= 20


def test_pathway_reason_names_the_choices_that_led_there():
    report = run(CONTENTS["software-developer"], ("dev-1-b", "dev-2-b", "dev-3-a"))
    assert report["pathway"]["kind"] == "transform"
    assert report["pathway"]["because"]["choices"] == ["dev-1-b", "dev-2-b"]
    labels = [c["choice_label"] for c in report["choices"][:2]]
    assert all(f'"{label}"' in report["pathway"]["reason"] for label in labels)


def test_a_tie_is_explained_as_a_tie():
    report = run(CONTENTS["software-developer"], ("dev-1-a", "dev-2-b", "dev-3-c"))  # 1 / 1 / 1
    assert report["pathway"]["kind"] == "adapt"
    assert "leaned equally" in report["pathway"]["reason"]
    assert "Adapt, Transform, Discover" in report["pathway"]["reason"]
    for other in report["other_pathways"]:
        assert "as much as the leading pathway" in other["reason"]


def test_a_clear_lead_is_not_called_a_tie():
    report = run(CONTENTS["software-developer"], ("dev-1-b", "dev-2-b", "dev-3-a"))  # 1 / 2 / 0
    assert "leaned equally" not in report["pathway"]["reason"]
    assert all("as much as" not in o["reason"] for o in report["other_pathways"])


def test_other_pathways_are_ordered_by_weight_then_fixed_order():
    report = run(CONTENTS["software-developer"], ("dev-1-b", "dev-2-b", "dev-3-c"))
    assert [p["kind"] for p in report["other_pathways"]] == ["discover", "adapt"]


def test_report_rejects_content_for_another_occupation():
    content = CONTENTS["software-developer"]
    with pytest.raises(ValueError):
        generate_report(content, "accountant", [], final_state(content, all_paths(content)[0]))


def test_report_is_rebuilt_from_choices_not_a_stale_state():
    content = CONTENTS["software-developer"]
    path = ("dev-1-a", "dev-2-a", "dev-3-a")
    stale = final_state(content, path)
    stale["capabilities"].append("removed_in_a_content_edit")
    report = generate_report(content, "software-developer", _choices(content, path), stale)
    assert report == run(content, path)


# --- Optional content fields: tasks, evidence and rules, from the same seed data ------------


def test_transferable_skills_are_in_both_tasks_and_the_leading_pathway():
    content = load_research_content("software-developer")
    report = run(content, ("dev-1-a", "dev-2-a", "dev-3-a"))
    task_skills = {s["slug"] for t in content["occupation"]["tasks"] for s in t["skills"]}
    pathway = next(p for p in content["pathways"] if p["kind"] == "adapt")
    expected = [s["slug"] for s in pathway["skills"] if s["slug"] in task_skills]
    assert expected, "the seed should share at least one skill between tasks and the Adapt pathway"
    assert [s["slug"] for s in report["transferable_skills"]] == expected
    assert all(s["reason"] for s in report["transferable_skills"])


def test_research_comes_from_rule_and_pathway_evidence_with_urls():
    content = load_research_content("software-developer")
    pathway = next(p for p in content["pathways"] if p["kind"] == "adapt")
    rule_evidence = next(k for k in content["evidence"] if k not in pathway["evidence_ids"])
    content["rules"] = [{
        "id": "dev-ai-review", "priority": 10, "when": {"tag": "ai_fluency"},
        "output": {"category": "skill", "title": "Review AI-written code", "description": ""},
        "reason": "You chose to review AI suggestions.", "evidence_ids": [rule_evidence],
    }]
    report = run(content, ("dev-1-a", "dev-2-a", "dev-3-a"))
    assert [r["id"] for r in report["research"]] == [rule_evidence, *pathway["evidence_ids"]]
    assert report["research"][0]["because"]["rule"] == "dev-ai-review"
    assert all(r["source"]["url"].startswith("https://") for r in report["research"])


# --- Backend integration: the backend's own contract checks ---------------------------------


def test_plugin_module_satisfies_backend_contract():
    module = importlib.import_module("app.services.scenario_engine.plugin")
    assert check_signatures(module) == []
    adapter = EngineAdapter(module)
    assert adapter.engine_id.endswith("@1.0.0")
    assert adapter.is_reference is False


@pytest.mark.parametrize("slug", OCCUPATIONS)
def test_backend_conformance_check_passes(slug):
    adapter = EngineAdapter(importlib.import_module("app.services.scenario_engine.plugin"))
    report = check_engine(adapter, CONTENTS[slug])
    assert report.problems == []
    assert report.complete_paths == 27
