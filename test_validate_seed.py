"""Mutation tests: break a good seed in one specific way and assert the validator notices.

Run:  pytest -q test_validate_seed.py
Each test names a mistake the ORIGINAL validate_seed.py either crashed on or silently passed.
"""
from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path

import pytest

from seed_schema import SeedFormatError, SeedValidationError, load_json_strict, load_seed
from validate_seed import analyse

SEED_PATH = Path(__file__).with_name("software-developer.json")
TODAY = date(2026, 11, 7)


@pytest.fixture()
def raw() -> dict:
    return load_json_strict(SEED_PATH)


def codes(raw: dict, *, strict: bool = False) -> set[str]:
    log, _ = analyse(raw, strict=strict, today=TODAY, max_paths=2000)
    return {p.code for p in log.errors}


def all_codes(raw: dict, *, strict: bool = False) -> set[str]:
    log, _ = analyse(raw, strict=strict, today=TODAY, max_paths=2000)
    return {p.code for p in log.items}


def choice(raw: dict, cid: str) -> dict:
    return next(c for s in raw["scenarios"] for c in s["choices"] if c["id"] == cid)


def test_baseline_draft_is_clean(raw):
    assert codes(raw) == set()


def test_baseline_strict_fails_only_on_known_placeholders(raw):
    assert codes(raw, strict=True) == {"W-TODO", "W-DRAFT-LABEL"}


# --- things the original crashed on -------------------------------------------------


def test_missing_signals_key_reports_instead_of_crashing(raw):
    del choice(raw, "dev-d1-adapt")["signals"]
    assert "E-SCHEMA" in codes(raw)


def test_cycle_does_not_recurse_forever(raw):
    choice(raw, "dev-d3-projects")["next_scenario_id"] = "dev-d1"
    assert {"E-CYCLE"} & codes(raw) or {"E-DEPTH-JUMP"} & codes(raw)


# --- things the original silently passed --------------------------------------------


def test_pathway_key_typo_is_rejected(raw):
    choice(raw, "dev-d1-adapt")["signals"]["pathway"] = {"adpat": 2}
    assert "E-SCHEMA" in codes(raw)


def test_unknown_rule_tag_is_an_error_not_a_silent_never_fires(raw):
    raw["rules"][0]["condition"] = {"tag": "engineering_fundamentls"}
    assert "E-REF" in codes(raw)


def test_unknown_field_is_rejected(raw):
    raw["occupation"]["salary"] = "high"
    assert "E-SCHEMA" in codes(raw)


def test_duplicate_json_key_is_rejected(tmp_path):
    p = tmp_path / "dup.json"
    p.write_text('{"tags": {}, "tags": {}}', encoding="utf-8")
    with pytest.raises(SeedFormatError):
        load_json_strict(p)


def test_todo_evidence_is_a_strict_error(raw):
    assert "W-TODO" in codes(raw, strict=True)
    assert "W-TODO" not in codes(raw, strict=False)


def test_news_only_evidence_cannot_back_a_rule(raw):
    raw["evidence"][1].update(evidence_class="news_corroboration")
    assert "E-NEWS-ONLY" in codes(raw)


def test_skill_rule_without_evidence_is_rejected(raw):
    next(r for r in raw["rules"] if r["id"] == "r-ai-tooling-skill")["evidence_ids"] = []
    assert "E-RULE-UNSOURCED" in codes(raw)


def test_contradictory_pathway_rule_is_flagged(raw):
    raw["rules"][0]["condition"] = {"all": [{"pathway": "adapt"}, {"pathway": "discover"}]}
    assert "E-CONTRADICTION" in codes(raw)


def test_empty_report_path_is_caught_with_an_example(raw):
    raw["rules"] = [r for r in raw["rules"] if "discover" not in json.dumps(r["condition"])]
    log, _ = analyse(raw, strict=False, today=TODAY, max_paths=2000)
    empty = [p for p in log.errors if p.code == "E-EMPTY-REPORT"]
    # discover paths still fire the cross-cutting communication rule on some paths, not all
    assert empty and "dev-d1-discover" in empty[0].message


def test_future_access_date_is_an_error(raw):
    raw["evidence"][0]["accessed_on"] = "2027-01-01"
    assert "E-DATE" in codes(raw)


def test_access_before_publication_is_an_error(raw):
    raw["evidence"][0]["published_on"] = "2026-12-01"
    assert "E-DATE" in codes(raw)


def test_orphan_evidence_is_warned(raw):
    raw["evidence"].append({**copy.deepcopy(raw["evidence"][0]), "id": "ev-099", "url": "https://example.org/x"})
    assert "W-ORPHAN-EVIDENCE" in all_codes(raw)


def test_task_without_judgement_label_is_flagged_in_strict(raw):
    raw["tasks"][0]["rationale"] = "AI will help with this and a person will still decide what matters in the end."
    assert "W-UNLABELLED-JUDGEMENT" in codes(raw, strict=True)


@pytest.mark.parametrize(
    "phrase",
    ["Your job will be replaced soon.", "No role is AI-proof.", "Some roles are at risk.", "Jobs will disappear."],
)
def test_banned_phrases_with_word_boundaries(raw, phrase):
    raw["pathways"][0]["description"] = phrase
    assert "E-BANNED" in codes(raw)


def test_percentage_is_strict_error(raw):
    raw["pathways"][0]["opportunities"][0] = "Demand is up 40% for people with this skill."
    assert "W-FIGURE" in codes(raw, strict=True)


def test_drift_that_only_reinforces_is_warned(raw):
    for c in raw["scenarios"][1]["choices"]:
        c["signals"]["pathway"] = {"adapt": 1}
    assert "W-NO-DRIFT" in all_codes(raw)


def test_missing_prompt_variant_is_warned(raw):
    del next(s for s in raw["scenarios"] if s["id"] == "dev-d3")["prompt_variants"]["discover"]
    assert "W-VARIANT-MISSING" in all_codes(raw)


# --- the loader Person 2 will call ----------------------------------------------------


def test_load_seed_lists_every_problem_with_ids(raw):
    choice(raw, "dev-d1-adapt")["next_scenario_id"] = "nope"
    choice(raw, "dev-d1-transform")["signals"]["capabilities"] = ["not_a_tag"]
    with pytest.raises(SeedValidationError) as err:
        load_seed(raw)
    text = "\n".join(err.value.problems)
    assert "dev-d1-adapt" in text and "dev-d1-transform" in text and len(err.value.problems) >= 2


def test_load_seed_accepts_the_good_file(raw):
    assert load_seed(raw).occupation.slug == "software-developer"