"""Checks on the curated research dataset in ``server/seed_data``."""

from sqlalchemy import func, select

from app.extensions import db
from app.models import ContentVersion, EvidenceLink, Occupation, Pathway, ScenarioChoice
from app.seed.loader import DEFAULT_SEED_DIR, load_dataset, read_dataset


def count(model):
    return db.session.execute(select(func.count()).select_from(model)).scalar_one()


def test_real_research_dataset_validates():
    ds = read_dataset(DEFAULT_SEED_DIR)
    assert len(ds.occupations.occupations) == 6
    assert all(len([t for t in ds.tasks.tasks if t.occupation == o.slug]) >= 5 for o in ds.occupations.occupations)
    for source in ds.sources.sources:
        assert source.url.scheme == "https"
        assert source.findings and source.limitations
    # Evidence from outside Africa must be labelled as such.
    regions = {s.key: s.region for s in ds.sources.sources}
    assert regions["klarna-ai-assistant-press-2024"] == "outside_africa"
    assert regions["ilostat-kenya-informal-employment-2019"] == "kenya"


def test_real_research_dataset_loads_idempotently(app):
    with app.app_context():
        first = load_dataset(DEFAULT_SEED_DIR)
        counts = {m.__name__: count(m) for m in (Occupation, Pathway, ScenarioChoice, EvidenceLink)}
        second = load_dataset(DEFAULT_SEED_DIR)
        assert first.created_version is True and second.created_version is False
        assert first.version == second.version
        assert {m.__name__: count(m) for m in (Occupation, Pathway, ScenarioChoice, EvidenceLink)} == counts
        assert count(ContentVersion) == 1
        assert counts["Occupation"] == 6


def test_every_occupation_cites_ilo_exposure_research_and_labels_editorial_notes():
    ds = read_dataset(DEFAULT_SEED_DIR)
    for occupation in ds.occupations.occupations:
        assert "ilo-wp140-genai-exposure-2025" in {e.source for e in occupation.evidence}
    for task in ds.tasks.tasks:
        assert task.transformation_note.startswith("FUTUREPRINT editorial note:")
        assert task.ilo_task_score is not None and task.isco_task_statement
    for event in ds.workforce.events:
        assert event.primary_source and event.interpretation_note
