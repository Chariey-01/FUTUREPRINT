"""Pydantic schemas for the curated seed-data files.

Every model forbids unknown fields so typos in research data fail loudly.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)]
Key = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10)]
PartialDate = Annotated[str, StringConstraints(pattern=r"^\d{4}(-\d{2}(-\d{2})?)?$")]
TraitName = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z_]{1,39}$")]

Region = Literal["kenya", "africa", "global", "outside_africa"]
EvidenceCategory = Literal[
    "ai_exposure_research",
    "labour_statistics",
    "employment_projection",
    "productivity_study",
    "workforce_event",
    "policy_guidance",
    "sector_report",
]
Gradient = Literal["not_exposed", "minimal_exposure", "gradient_1", "gradient_2", "gradient_3", "gradient_4"]
PathwayKind = Literal["adapt", "transform", "discover"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class EvidenceRef(Strict):
    source: Slug
    note: LongText


class Finding(Strict):
    statement: LongText
    verbatim: bool
    locator: str | None = None


class SourceIn(Strict):
    key: Slug
    organisation: Text
    title: Text
    authors: list[Text] = []
    url: HttpUrl
    publication_date: PartialDate | None
    retrieved_on: date
    evidence_category: EvidenceCategory
    geographic_scope: Text
    region: Region
    source_type: Literal["primary", "secondary"] = "primary"
    summary: LongText
    findings: list[Finding] = Field(min_length=1)
    confidence: Literal["high", "medium", "low"]
    limitations: LongText

    @field_validator("url")
    @classmethod
    def _https_only(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("source URLs must use https")
        return value


class SkillIn(Strict):
    slug: Slug
    name: Text
    category: Literal["digital", "technical", "human", "domain", "ai"]
    description: LongText


class OccupationSkillRef(Strict):
    skill: Slug
    importance: Literal["core", "supporting", "emerging"]


class ExposureIn(Strict):
    gradient: Gradient
    label: Text
    mean_score: float | None = Field(default=None, ge=0, le=1)
    score_sd: float | None = Field(default=None, ge=0, le=1)
    summary: LongText


class OccupationIn(Strict):
    slug: Slug
    name: Text
    category: Text
    isco_08_code: Annotated[str, StringConstraints(pattern=r"^\d{4}$")] | None = None
    isco_08_title: Text | None = None
    summary: LongText
    description: LongText
    responsibilities: list[Text] = Field(min_length=3)
    exposure: ExposureIn
    kenya_context: LongText
    limitations: LongText
    skills: list[OccupationSkillRef] = Field(min_length=1)
    evidence: list[EvidenceRef] = Field(min_length=1)
    display_order: int = 0


class TaskIn(Strict):
    occupation: Slug
    slug: Slug
    title: Text
    isco_task_statement: Text | None = None
    ilo_task_score: float | None = Field(default=None, ge=0, le=1)
    exposure_level: Literal["very_low", "low", "medium", "high"]
    exposure_basis: Text
    likely_change: Literal["mostly_human", "augmentation", "partial_automation"]
    transformation_note: LongText
    skills: list[Slug] = []
    evidence: list[EvidenceRef] = []
    display_order: int = 0


class PathwayIn(Strict):
    occupation: Slug
    slug: Slug
    kind: PathwayKind
    title: Text
    summary: LongText
    steps: list[Text] = Field(min_length=2)
    target_roles: list[Text] = []
    skills: list[Slug] = []
    evidence: list[EvidenceRef] = []
    is_illustrative: bool = True
    display_order: int = 0


class ChoiceIn(Strict):
    key: Key
    label: Text
    description: LongText
    feedback: LongText
    pathway_kind: PathwayKind | None = None
    effects: dict[TraitName, Annotated[int, Field(ge=-3, le=3)]] = {}
    next: Key | None = None


class ScenarioIn(Strict):
    occupation: Slug
    key: Key
    title: Text
    narrative: LongText
    is_start: bool = False
    task: Slug | None = None
    choices: list[ChoiceIn] = Field(min_length=2, max_length=5)
    evidence: list[EvidenceRef] = []
    display_order: int = 0


class CompanyIn(Strict):
    slug: Slug
    name: Text
    headquarters_country: Text
    sector: Text
    website: HttpUrl | None = None


class ReportedFigure(Strict):
    figure: Text
    context: LongText
    verbatim: bool


class EventIn(Strict):
    slug: Slug
    company: Slug | None = None
    title: Text
    event_date: date
    event_type: Literal["ai_deployment", "workforce_reduction", "skills_programme", "technology_adoption"]
    summary: LongText
    reported_figures: list[ReportedFigure] = []
    interpretation_note: LongText
    geographic_scope: Text
    region: Region
    occupations: list[Slug] = []
    primary_source: Slug
    evidence: list[EvidenceRef] = []


class ValidationRules(Strict):
    min_tasks_per_occupation: int = Field(default=5, ge=1)
    require_all_pathway_kinds: bool = True
    require_simulation_per_occupation: bool = True


class ManifestIn(Strict):
    dataset_version: Annotated[str, StringConstraints(pattern=r"^[0-9A-Za-z.\-]{1,40}$")]
    retrieved_through: date
    description: LongText
    validation_rules: ValidationRules = ValidationRules()
    methodology: dict[str, Any]


# File wrappers ---------------------------------------------------------------


class SourcesFile(Strict):
    sources: list[SourceIn]


class SkillsFile(Strict):
    skills: list[SkillIn]


class OccupationsFile(Strict):
    occupations: list[OccupationIn] = Field(min_length=1)


class TasksFile(Strict):
    tasks: list[TaskIn]


class PathwaysFile(Strict):
    pathways: list[PathwayIn]


class ScenariosFile(Strict):
    scenarios: list[ScenarioIn]


class WorkforceEventsFile(Strict):
    companies: list[CompanyIn] = []
    events: list[EventIn] = []


SEED_FILES: dict[str, type[Strict]] = {
    "manifest.json": ManifestIn,
    "evidence_sources.json": SourcesFile,
    "skills.json": SkillsFile,
    "occupations.json": OccupationsFile,
    "tasks.json": TasksFile,
    "pathways.json": PathwaysFile,
    "scenarios.json": ScenariosFile,
    "workforce_events.json": WorkforceEventsFile,
}
