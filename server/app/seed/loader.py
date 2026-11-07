"""Validate curated seed data and load it into PostgreSQL idempotently.

Usage (from ``server/``)::

    flask seed validate            # schema + cross-reference checks only
    flask seed load                # validate, then upsert in one transaction

Loading is idempotent: deterministic UUIDs plus ``ON CONFLICT DO UPDATE``
mean re-running the command updates rows in place instead of duplicating
them. Records removed from the seed files are pruned. If removed content is
still referenced by user sessions or reports, the whole load is rolled back.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.seed import ids
from app.seed.schemas import (
    SEED_FILES,
    ManifestIn,
    OccupationsFile,
    PathwaysFile,
    ScenariosFile,
    SkillsFile,
    SourcesFile,
    TasksFile,
    WorkforceEventsFile,
)

DEFAULT_SEED_DIR = Path(__file__).resolve().parents[2] / "seed_data"


class SeedValidationError(ValueError):
    def __init__(self, errors: list[str]) -> None:
        super().__init__(f"{len(errors)} seed data error(s):\n  - " + "\n  - ".join(errors))
        self.errors = errors


@dataclass(frozen=True)
class Dataset:
    manifest: ManifestIn
    sources: SourcesFile
    skills: SkillsFile
    occupations: OccupationsFile
    tasks: TasksFile
    pathways: PathwaysFile
    scenarios: ScenariosFile
    workforce: WorkforceEventsFile
    checksum: str
    file_checksums: dict[str, str]

    @property
    def version(self) -> str:
        return f"{self.manifest.dataset_version}+{self.checksum[:8]}"


@dataclass
class LoadResult:
    version: str
    checksum: str
    created_version: bool
    counts: dict[str, int] = field(default_factory=dict)
    pruned: dict[str, int] = field(default_factory=dict)


# --- reading & validation -----------------------------------------------------


def read_dataset(seed_dir: Path | str = DEFAULT_SEED_DIR) -> Dataset:
    """Parse every seed file and run cross-file validation. Raises
    :class:`SeedValidationError` listing *all* problems found."""
    seed_dir = Path(seed_dir)
    errors: list[str] = []
    parsed: dict[str, Any] = {}
    raw_payloads: dict[str, Any] = {}
    file_checksums: dict[str, str] = {}

    for filename, model in SEED_FILES.items():
        path = seed_dir / filename
        if not path.is_file():
            errors.append(f"{filename}: file is missing")
            continue
        raw_bytes = path.read_bytes()
        file_checksums[filename] = hashlib.sha256(raw_bytes).hexdigest()
        try:
            payload = json.loads(raw_bytes)
        except json.JSONDecodeError as exc:
            errors.append(f"{filename}: invalid JSON ({exc.msg} at line {exc.lineno})")
            continue
        raw_payloads[filename] = payload
        try:
            parsed[filename] = model.model_validate(payload)
        except ValidationError as exc:
            for err in exc.errors(include_url=False, include_input=False):
                loc = ".".join(str(p) for p in err["loc"])
                errors.append(f"{filename}: {loc}: {err['msg']}")
    if errors:
        raise SeedValidationError(errors)

    canonical = json.dumps(raw_payloads, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    dataset = Dataset(
        manifest=parsed["manifest.json"],
        sources=parsed["evidence_sources.json"],
        skills=parsed["skills.json"],
        occupations=parsed["occupations.json"],
        tasks=parsed["tasks.json"],
        pathways=parsed["pathways.json"],
        scenarios=parsed["scenarios.json"],
        workforce=parsed["workforce_events.json"],
        checksum=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        file_checksums=file_checksums,
    )
    cross_errors = validate_references(dataset)
    if cross_errors:
        raise SeedValidationError(cross_errors)
    return dataset


def _duplicates(values: list[Any]) -> list[Any]:
    return [v for v, n in Counter(values).items() if n > 1]


def validate_references(ds: Dataset) -> list[str]:
    errors: list[str] = []
    rules = ds.manifest.validation_rules

    source_keys = {s.key for s in ds.sources.sources}
    skill_slugs = {s.slug for s in ds.skills.skills}
    occupation_slugs = {o.slug for o in ds.occupations.occupations}
    company_slugs = {c.slug for c in ds.workforce.companies}
    task_keys = {(t.occupation, t.slug) for t in ds.tasks.tasks}

    for label, values in (
        ("evidence source key", [s.key for s in ds.sources.sources]),
        ("skill slug", [s.slug for s in ds.skills.skills]),
        ("occupation slug", [o.slug for o in ds.occupations.occupations]),
        ("task", [(t.occupation, t.slug) for t in ds.tasks.tasks]),
        ("pathway", [(p.occupation, p.slug) for p in ds.pathways.pathways]),
        ("scenario", [(s.occupation, s.key) for s in ds.scenarios.scenarios]),
        ("company slug", [c.slug for c in ds.workforce.companies]),
        ("workforce event slug", [e.slug for e in ds.workforce.events]),
    ):
        for dup in _duplicates(values):
            errors.append(f"duplicate {label}: {dup}")

    def check_evidence(where: str, refs: list[Any]) -> None:
        for ref in refs:
            if ref.source not in source_keys:
                errors.append(f"{where}: unknown evidence source '{ref.source}'")
        for dup in _duplicates([r.source for r in refs]):
            errors.append(f"{where}: evidence source '{dup}' listed twice")

    def check_skills(where: str, slugs: list[str]) -> None:
        for slug in slugs:
            if slug not in skill_slugs:
                errors.append(f"{where}: unknown skill '{slug}'")
        for dup in _duplicates(slugs):
            errors.append(f"{where}: skill '{dup}' listed twice")

    for occ in ds.occupations.occupations:
        where = f"occupation '{occ.slug}'"
        check_evidence(where, occ.evidence)
        check_skills(where, [s.skill for s in occ.skills])

    tasks_per_occupation: Counter[str] = Counter()
    for task in ds.tasks.tasks:
        where = f"task '{task.occupation}/{task.slug}'"
        if task.occupation not in occupation_slugs:
            errors.append(f"{where}: unknown occupation")
        tasks_per_occupation[task.occupation] += 1
        check_skills(where, task.skills)
        check_evidence(where, task.evidence)
    for occ in occupation_slugs:
        if tasks_per_occupation[occ] < rules.min_tasks_per_occupation:
            errors.append(
                f"occupation '{occ}': has {tasks_per_occupation[occ]} task(s), "
                f"needs at least {rules.min_tasks_per_occupation}"
            )

    kinds_per_occupation: dict[str, set[str]] = defaultdict(set)
    for pathway in ds.pathways.pathways:
        where = f"pathway '{pathway.occupation}/{pathway.slug}'"
        if pathway.occupation not in occupation_slugs:
            errors.append(f"{where}: unknown occupation")
        kinds_per_occupation[pathway.occupation].add(pathway.kind)
        check_skills(where, pathway.skills)
        check_evidence(where, pathway.evidence)
    if rules.require_all_pathway_kinds:
        for occ in occupation_slugs:
            missing = {"adapt", "transform", "discover"} - kinds_per_occupation[occ]
            if missing:
                errors.append(f"occupation '{occ}': missing pathway kind(s) {sorted(missing)}")

    errors.extend(_validate_scenarios(ds, occupation_slugs, task_keys, check_evidence))

    for event in ds.workforce.events:
        where = f"workforce event '{event.slug}'"
        if event.company and event.company not in company_slugs:
            errors.append(f"{where}: unknown company '{event.company}'")
        if event.primary_source not in source_keys:
            errors.append(f"{where}: unknown primary source '{event.primary_source}'")
        for occ in event.occupations:
            if occ not in occupation_slugs:
                errors.append(f"{where}: unknown occupation '{occ}'")
        check_evidence(where, event.evidence)
    return errors


def _validate_scenarios(ds: Dataset, occupation_slugs: set[str], task_keys: set[tuple[str, str]], check_evidence: Any) -> list[str]:
    errors: list[str] = []
    by_occupation: dict[str, dict[str, Any]] = defaultdict(dict)
    for scenario in ds.scenarios.scenarios:
        where = f"scenario '{scenario.occupation}/{scenario.key}'"
        if scenario.occupation not in occupation_slugs:
            errors.append(f"{where}: unknown occupation")
            continue
        if scenario.task and (scenario.occupation, scenario.task) not in task_keys:
            errors.append(f"{where}: unknown task '{scenario.task}' for this occupation")
        for dup in _duplicates([c.key for c in scenario.choices]):
            errors.append(f"{where}: duplicate choice key '{dup}'")
        check_evidence(where, scenario.evidence)
        by_occupation[scenario.occupation][scenario.key] = scenario

    if ds.manifest.validation_rules.require_simulation_per_occupation:
        for occ in occupation_slugs - set(by_occupation):
            errors.append(f"occupation '{occ}': has no simulation scenarios")

    for occ, scenarios in by_occupation.items():
        starts = [k for k, s in scenarios.items() if s.is_start]
        if len(starts) != 1:
            errors.append(f"occupation '{occ}': needs exactly one start scenario, found {len(starts)}")
            continue
        for key, scenario in scenarios.items():
            for choice in scenario.choices:
                if choice.next is not None and choice.next not in scenarios:
                    errors.append(f"scenario '{occ}/{key}' choice '{choice.key}': unknown next scenario '{choice.next}'")
                if choice.next == key:
                    errors.append(f"scenario '{occ}/{key}' choice '{choice.key}': cannot loop to itself")
        # Every scenario must be reachable from the start, and the graph must be
        # acyclic so that each session is guaranteed to finish.
        visiting: set[str] = set()
        done: set[str] = set()

        def visit(node: str, occ: str = occ, scenarios: dict[str, Any] = scenarios) -> bool:
            if node in visiting:
                return False
            if node in done:
                return True
            visiting.add(node)
            ok = True
            for choice in scenarios[node].choices:
                if choice.next in scenarios and not visit(choice.next):
                    ok = False
            visiting.discard(node)
            done.add(node)
            return ok

        if not visit(starts[0]):
            errors.append(f"occupation '{occ}': scenario graph contains a cycle")
        unreachable = set(scenarios) - done
        if unreachable:
            errors.append(f"occupation '{occ}': unreachable scenario(s) {sorted(unreachable)}")
    return errors


# --- row building -------------------------------------------------------------


def build_rows(ds: Dataset) -> dict[str, list[dict[str, Any]]]:
    """Translate the validated dataset into table rows keyed by table name."""
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for s in ds.sources.sources:
        rows["evidence_sources"].append(
            {
                "id": ids.source_id(s.key),
                "key": s.key,
                "organisation": s.organisation,
                "title": s.title,
                "authors": list(s.authors),
                "url": str(s.url),
                "publication_date": s.publication_date,
                "retrieved_on": s.retrieved_on,
                "evidence_category": s.evidence_category,
                "geographic_scope": s.geographic_scope,
                "region": s.region,
                "source_type": s.source_type,
                "summary": s.summary,
                "findings": [f.model_dump() for f in s.findings],
                "confidence": s.confidence,
                "limitations": s.limitations,
            }
        )
    for sk in ds.skills.skills:
        rows["skills"].append(
            {"id": ids.skill_id(sk.slug), "slug": sk.slug, "name": sk.name, "category": sk.category, "description": sk.description}
        )
    for c in ds.workforce.companies:
        rows["companies"].append(
            {
                "id": ids.company_id(c.slug),
                "slug": c.slug,
                "name": c.name,
                "headquarters_country": c.headquarters_country,
                "sector": c.sector,
                "website": str(c.website) if c.website else None,
            }
        )

    def link(ref: Any, **target: Any) -> dict[str, Any]:
        row = {
            "evidence_source_id": ids.source_id(ref.source),
            "occupation_id": None,
            "task_id": None,
            "pathway_id": None,
            "scenario_id": None,
            "workforce_event_id": None,
            "note": ref.note,
        }
        row.update(target)
        row["id"] = ids.content_id("evidence-link", ref.source, *(str(v) for v in target.values()))
        return row

    for o in ds.occupations.occupations:
        oid = ids.occupation_id(o.slug)
        rows["occupations"].append(
            {
                "id": oid,
                "slug": o.slug,
                "name": o.name,
                "category": o.category,
                "isco_08_code": o.isco_08_code,
                "isco_08_title": o.isco_08_title,
                "summary": o.summary,
                "description": o.description,
                "responsibilities": list(o.responsibilities),
                "exposure_gradient": o.exposure.gradient,
                "exposure_label": o.exposure.label,
                "exposure_mean_score": o.exposure.mean_score,
                "exposure_score_sd": o.exposure.score_sd,
                "exposure_summary": o.exposure.summary,
                "kenya_context": o.kenya_context,
                "limitations": o.limitations,
                "display_order": o.display_order,
            }
        )
        for ref in o.skills:
            rows["occupation_skills"].append(
                {"occupation_id": oid, "skill_id": ids.skill_id(ref.skill), "importance": ref.importance}
            )
        rows["evidence_links"].extend(link(ref, occupation_id=oid) for ref in o.evidence)

    for t in ds.tasks.tasks:
        tid = ids.task_id(t.occupation, t.slug)
        rows["tasks"].append(
            {
                "id": tid,
                "occupation_id": ids.occupation_id(t.occupation),
                "slug": t.slug,
                "title": t.title,
                "isco_task_statement": t.isco_task_statement,
                "ilo_task_score": t.ilo_task_score,
                "exposure_level": t.exposure_level,
                "exposure_basis": t.exposure_basis,
                "likely_change": t.likely_change,
                "transformation_note": t.transformation_note,
                "display_order": t.display_order,
            }
        )
        rows["task_skills"].extend({"task_id": tid, "skill_id": ids.skill_id(s)} for s in t.skills)
        rows["evidence_links"].extend(link(ref, task_id=tid) for ref in t.evidence)

    for p in ds.pathways.pathways:
        pid = ids.pathway_id(p.occupation, p.slug)
        rows["pathways"].append(
            {
                "id": pid,
                "occupation_id": ids.occupation_id(p.occupation),
                "slug": p.slug,
                "kind": p.kind,
                "title": p.title,
                "summary": p.summary,
                "steps": list(p.steps),
                "target_roles": list(p.target_roles),
                "is_illustrative": p.is_illustrative,
                "display_order": p.display_order,
            }
        )
        rows["pathway_skills"].extend({"pathway_id": pid, "skill_id": ids.skill_id(s)} for s in p.skills)
        rows["evidence_links"].extend(link(ref, pathway_id=pid) for ref in p.evidence)

    for s in ds.scenarios.scenarios:
        sid = ids.scenario_id(s.occupation, s.key)
        rows["scenarios"].append(
            {
                "id": sid,
                "occupation_id": ids.occupation_id(s.occupation),
                "task_id": ids.task_id(s.occupation, s.task) if s.task else None,
                "key": s.key,
                "title": s.title,
                "narrative": s.narrative,
                "is_start": s.is_start,
                "is_illustrative": True,
                "display_order": s.display_order,
            }
        )
        for order, ch in enumerate(s.choices):
            rows["scenario_choices"].append(
                {
                    "id": ids.choice_id(s.occupation, s.key, ch.key),
                    "scenario_id": sid,
                    "next_scenario_id": ids.scenario_id(s.occupation, ch.next) if ch.next else None,
                    "key": ch.key,
                    "label": ch.label,
                    "description": ch.description,
                    "feedback": ch.feedback,
                    "pathway_kind": ch.pathway_kind,
                    "effects": dict(ch.effects),
                    "display_order": order,
                }
            )
        rows["evidence_links"].extend(link(ref, scenario_id=sid) for ref in s.evidence)

    for e in ds.workforce.events:
        eid = ids.event_id(e.slug)
        rows["workforce_events"].append(
            {
                "id": eid,
                "slug": e.slug,
                "company_id": ids.company_id(e.company) if e.company else None,
                "primary_source_id": ids.source_id(e.primary_source),
                "title": e.title,
                "event_date": e.event_date,
                "event_type": e.event_type,
                "summary": e.summary,
                "reported_figures": [f.model_dump() for f in e.reported_figures],
                "interpretation_note": e.interpretation_note,
                "geographic_scope": e.geographic_scope,
                "region": e.region,
            }
        )
        rows["workforce_event_occupations"].extend(
            {"workforce_event_id": eid, "occupation_id": ids.occupation_id(o)} for o in e.occupations
        )
        rows["evidence_links"].extend(link(ref, workforce_event_id=eid) for ref in e.evidence)
    return rows


def build_manifest(ds: Dataset, rows: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "dataset_version": ds.manifest.dataset_version,
        "version": ds.version,
        "checksum": ds.checksum,
        "retrieved_through": ds.manifest.retrieved_through.isoformat(),
        "description": ds.manifest.description,
        "files": ds.file_checksums,
        "counts": {table: len(r) for table, r in sorted(rows.items())},
        "methodology": ds.manifest.methodology,
    }


def load_dataset(seed_dir: Path | str = DEFAULT_SEED_DIR) -> LoadResult:
    """Validate and load the dataset in a single transaction."""
    from app.repositories import seed_repository

    ds = read_dataset(seed_dir)
    rows = build_rows(ds)
    return seed_repository.apply_dataset(
        rows, version=ds.version, checksum=ds.checksum, manifest=build_manifest(ds, rows)
    )
