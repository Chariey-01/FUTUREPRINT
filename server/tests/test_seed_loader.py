import json

import pytest
from sqlalchemy import func, select

from app.extensions import db
from app.models import ContentVersion, Occupation
from app.repositories.seed_repository import SeedConflictError
from app.seed import ids
from app.seed.loader import SeedValidationError, load_dataset, read_dataset
from tests.conftest import auth, write_dataset


def count(model):
    return db.session.execute(select(func.count()).select_from(model)).scalar_one()


def test_ids_are_deterministic(app, seed_dir):
    with app.app_context():
        load_dataset(seed_dir)
        occ = db.session.execute(select(Occupation).where(Occupation.slug == "test-occupation")).scalar_one()
        assert occ.id == ids.occupation_id("test-occupation")


def test_changed_content_creates_new_version_and_updates_in_place(app, tmp_path, minimal_dataset):
    with app.app_context():
        load_dataset(write_dataset(tmp_path / "v1", minimal_dataset))
        minimal_dataset["occupations.json"]["occupations"][0]["name"] = "Renamed Occupation"
        result = load_dataset(write_dataset(tmp_path / "v2", minimal_dataset))
        assert result.created_version is True
        assert count(ContentVersion) == 2
        active = db.session.execute(select(ContentVersion).where(ContentVersion.is_active)).scalars().all()
        assert [v.version for v in active] == [result.version]
        occ = db.session.get(Occupation, ids.occupation_id("test-occupation"))
        assert occ.name == "Renamed Occupation"
        assert count(Occupation) == 2


def test_removed_records_are_pruned(app, tmp_path, minimal_dataset):
    with app.app_context():
        load_dataset(write_dataset(tmp_path / "v1", minimal_dataset))
        minimal_dataset["workforce_events.json"] = {"companies": [], "events": []}
        result = load_dataset(write_dataset(tmp_path / "v2", minimal_dataset))
        assert result.pruned == {"workforce_events": 1, "companies": 1}


def test_pruning_referenced_content_rolls_back(app, client, tmp_path, minimal_dataset, seed_dir):
    with app.app_context():
        load_dataset(seed_dir)
    token = client.post("/api/v1/sessions", json={"occupation_slug": "other-occupation"}).get_json()["session_token"]
    minimal_dataset["occupations.json"]["occupations"] = minimal_dataset["occupations.json"]["occupations"][:1]
    for name, key in (("tasks.json", "tasks"), ("pathways.json", "pathways"), ("scenarios.json", "scenarios")):
        minimal_dataset[name][key] = [r for r in minimal_dataset[name][key] if r["occupation"] != "other-occupation"]
    with app.app_context():
        with pytest.raises(SeedConflictError):
            load_dataset(write_dataset(tmp_path / "v2", minimal_dataset))
        assert count(Occupation) == 2  # rolled back
    assert client.get("/api/v1/sessions/current", headers=auth(token)).status_code == 200


def _expect_errors(tmp_path, dataset, *fragments):
    with pytest.raises(SeedValidationError) as exc:
        read_dataset(write_dataset(tmp_path / "bad", dataset))
    message = str(exc.value)
    for fragment in fragments:
        assert fragment in message, message


def test_unknown_references_are_reported(tmp_path, minimal_dataset):
    minimal_dataset["occupations.json"]["occupations"][0]["evidence"][0]["source"] = "missing-source"
    minimal_dataset["tasks.json"]["tasks"][0]["skills"] = ["missing-skill"]
    _expect_errors(tmp_path, minimal_dataset, "unknown evidence source 'missing-source'", "unknown skill 'missing-skill'")


def test_scenario_cycle_and_unreachable_nodes_are_rejected(tmp_path, minimal_dataset):
    scenarios = minimal_dataset["scenarios.json"]["scenarios"]
    scenarios[2]["choices"][0]["next"] = "s1"  # s3 -> s1 creates a cycle
    _expect_errors(tmp_path, minimal_dataset, "cycle")


def test_unreachable_scenario_rejected(tmp_path, minimal_dataset):
    scenarios = minimal_dataset["scenarios.json"]["scenarios"]
    scenarios[0]["choices"][2]["next"] = "s2"
    scenarios[1]["choices"][1]["next"] = None  # nothing reaches s3 now
    _expect_errors(tmp_path, minimal_dataset, "unreachable scenario(s) ['s3']")


def test_schema_errors_unknown_fields_and_insecure_urls(tmp_path, minimal_dataset):
    minimal_dataset["skills.json"]["skills"][0]["colour"] = "blue"
    minimal_dataset["evidence_sources.json"]["sources"][0]["url"] = "http://example.org/insecure"
    _expect_errors(tmp_path, minimal_dataset, "skills.json: skills.0.colour", "https")


def test_missing_file_and_invalid_json(tmp_path, minimal_dataset):
    directory = write_dataset(tmp_path / "bad", minimal_dataset)
    (directory / "skills.json").unlink()
    (directory / "tasks.json").write_text("{not json")
    with pytest.raises(SeedValidationError) as exc:
        read_dataset(directory)
    assert "skills.json: file is missing" in str(exc.value)
    assert "tasks.json: invalid JSON" in str(exc.value)


def test_duplicate_slugs_and_missing_pathway_kinds(tmp_path, minimal_dataset):
    skills = minimal_dataset["skills.json"]["skills"]
    skills.append(dict(skills[0]))
    minimal_dataset["pathways.json"]["pathways"] = [
        p for p in minimal_dataset["pathways.json"]["pathways"] if p["kind"] != "discover" or p["occupation"] != "test-occupation"
    ]
    _expect_errors(tmp_path, minimal_dataset, "duplicate skill slug: skill-a", "missing pathway kind(s) ['discover']")


def test_cli_validate_and_load(app, seed_dir):
    runner = app.test_cli_runner()
    validated = runner.invoke(args=["seed", "validate", "--path", str(seed_dir)])
    assert validated.exit_code == 0 and "valid" in validated.output
    loaded = runner.invoke(args=["seed", "load", "--path", str(seed_dir)])
    assert loaded.exit_code == 0 and "new version created" in loaded.output
    bad = seed_dir / "skills.json"
    bad.write_text(json.dumps({"skills": "nope"}))
    failed = runner.invoke(args=["seed", "validate", "--path", str(seed_dir)])
    assert failed.exit_code != 0 and "skills.json" in failed.output
