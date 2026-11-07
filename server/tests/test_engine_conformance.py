"""Engine conformance checker and the ``flask engine check`` command."""

import sys

from app import create_app
from app.engine import reference
from app.engine.adapter import EngineAdapter, load_engine
from app.engine.conformance import check_engine
from app.extensions import db
from app.seed import ids
from app.seed.loader import DEFAULT_SEED_DIR, load_dataset
from app.services import engine_service
from app.services.content_service import build_engine_content
from tests.test_engine_integration import FIXTURE_ENGINE, fake_module


def _fixture_content(app):
    from app.repositories import content_repository

    with app.app_context():
        occ = content_repository.get_occupation_by_slug("test-occupation")
        return build_engine_content(occ, content_repository.get_active_content_version())


def test_reference_and_fixture_engines_conform(app, seeded):
    content = _fixture_content(app)
    ref = check_engine(load_engine(None, allow_reference=True), content)
    assert ref.ok, ref.problems
    # s1a->s2a, s1a->s2b->s3{a,b}, the same three from s1b, and s1c->s3{a,b}
    assert ref.complete_paths == 8
    fixture = check_engine(load_engine(FIXTURE_ENGINE), content)
    assert fixture.ok, fixture.problems
    assert fixture.complete_paths == 6  # locked "c" is hidden, removing the two s1c paths


def test_conformance_detects_contract_problems(app, seeded):
    content = _fixture_content(app)
    counter = {"n": 0}

    def nondeterministic(content, state, sid, cid):
        counter["n"] += 1
        result = reference.apply_choice(content, state, sid, cid)
        result["state"]["nonce"] = counter["n"]
        return result

    def mutating(content, state, sid, cid):
        state["oops"] = True
        return reference.apply_choice(content, state, sid, cid)

    s2, s3 = str(ids.scenario_id("test-occupation", "s2")), str(ids.scenario_id("test-occupation", "s3"))

    def looping(content, state, sid, cid):
        return {"state": state, "completed": False, "next_scenario_id": s3 if sid != s3 else s2}

    def rejecting(content, state, sid, cid):
        raise reference.InvalidChoiceError("locked")

    cases = {
        "not deterministic": nondeterministic,
        "mutates its arguments": mutating,
        "did not complete within": looping,
        "but apply_choice rejects it": rejecting,
    }
    for expected, apply in cases.items():
        engine = EngineAdapter(fake_module("bad", apply_choice=apply, InvalidChoiceError=reference.InvalidChoiceError))
        result = check_engine(engine, content, max_steps=10)
        assert any(expected in p for p in result.problems), (expected, result.problems)


def test_engine_check_command_against_real_dataset(app):
    with app.app_context():
        load_dataset(DEFAULT_SEED_DIR)
        reports = engine_service.run_conformance()
    assert len(reports) == 6 and all(r.ok for r in reports), [r.problems for r in reports]
    assert all(r.complete_paths == 27 for r in reports)  # 3 scenarios x 3 choices each
    result = app.test_cli_runner().invoke(args=["engine", "check"])
    assert result.exit_code == 0, result.output
    assert "reference stand-in: True" in result.output and "conforms to the contract" in result.output


def test_engine_check_command_reports_failures(settings, seeded, monkeypatch):
    calls = {"n": 0}

    def flaky_report(content, slug, choices, state):
        calls["n"] += 1
        return {"n": calls["n"]}

    monkeypatch.setitem(sys.modules, "flaky_engine", fake_module("flaky_engine", generate_report=flaky_report))
    app = create_app(settings.model_copy(update={"scenario_engine_module": "flaky_engine"}))
    result = app.test_cli_runner().invoke(args=["engine", "check", "--occupation", "test-occupation"])
    assert result.exit_code != 0
    assert "generate_report() is not deterministic" in result.output
    with app.app_context():
        db.engine.dispose()
