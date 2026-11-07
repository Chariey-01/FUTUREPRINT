"""FUTUREPRINT seed schema: the single source of truth for the seed file format.

Why this module exists
----------------------
The PRD (section 10) says "Pick Pydantic only; two validation libraries means two ways
to do the same job". The same reasoning applies to the seed format: if the lint script
and ``flask seed`` each hand-roll their own checks, they drift apart and a file that
lints clean can still fail to load (or worse, load broken content).

So both import this module:

* ``validate_seed.py`` (Person 4) uses it, then adds graph / rule / content analysis.
* ``flask seed`` (Person 2) calls ``load_seed(raw)``, which raises ``SeedValidationError``
  listing *every* problem, including the offending ids.

This module also holds the *reference semantics* of the rule language
(``dominant_pathway``, ``condition_holds``). Person 3's engine should import these or be
tested against them, so the validator and the engine can never disagree about what a
rule means.

Structural rules live here. Policy rules (TODO-free, dates, source quality) live in
``validate_seed.py`` because they depend on draft vs strict mode.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Iterator, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

# --------------------------------------------------------------------------- constants

#: Fixed tie-break order from the PRD (section 13): Adapt, Transform, Discover.
PATHWAY_ORDER: tuple[str, ...] = ("adapt", "transform", "discover")

PathwayKind = Literal["adapt", "transform", "discover"]
EvidenceClass = Literal["primary", "official_statistic", "research", "news_corroboration"]
Classification = Literal["automated", "augmented", "human_centred"]
OutputType = Literal["activity", "skill"]

MAX_PROMPT_CHARS = 199  # PRD: prompts under 200 characters (readable on a phone)
MAX_LABEL_CHARS = 79  # PRD: choice labels under 80 characters

Slug = Annotated[
    str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=1, max_length=64)
]
TagKey = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]*$", min_length=1, max_length=48)]
Text = Annotated[str, StringConstraints(min_length=1)]


# --------------------------------------------------------------------------- models


class _Strict(BaseModel):
    """Unknown fields are rejected (PRD section 15: 'Pydantic rejects unknown fields')."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)


class ContentVersion(_Strict):
    label: Text


class Occupation(_Strict):
    slug: Slug
    title: Text
    aliases: list[Text] = Field(min_length=1)
    summary: Text
    onet_code: str = Field(pattern=r"^\d{2}-\d{4}\.\d{2}$")


class Tags(_Strict):
    capabilities: dict[TagKey, Text] = Field(min_length=1)
    tradeoffs: dict[TagKey, Text] = Field(min_length=1)


class Signals(_Strict):
    #: pathway weight added by this choice, e.g. {"adapt": 2}. Keys must be real pathways,
    #: so a typo such as "adpat" fails loudly instead of being silently ignored.
    pathway: dict[PathwayKind, Annotated[int, Field(ge=1, le=5)]] = Field(default_factory=dict)
    capabilities: list[TagKey] = Field(min_length=1)  # PRD: every choice adds a capability
    tradeoffs: list[TagKey] = Field(default_factory=list)

    @model_validator(mode="after")
    def _no_duplicate_tags(self) -> "Signals":
        for name in ("capabilities", "tradeoffs"):
            values = getattr(self, name)
            if len(values) != len(set(values)):
                raise ValueError(f"duplicate entries in {name}: {values}")
        return self


class Choice(_Strict):
    id: Slug
    label: Annotated[str, StringConstraints(min_length=1, max_length=MAX_LABEL_CHARS)]
    next_scenario_id: Slug | None
    signals: Signals


class Scenario(_Strict):
    id: Slug
    depth: int = Field(ge=1, le=6)
    prompt: Annotated[str, StringConstraints(min_length=1, max_length=MAX_PROMPT_CHARS)]
    prompt_variants: dict[
        PathwayKind, Annotated[str, StringConstraints(min_length=1, max_length=MAX_PROMPT_CHARS)]
    ] = Field(default_factory=dict)
    choices: list[Choice] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def _unique_labels(self) -> "Scenario":
        ids = [c.id for c in self.choices]
        labels = [c.label.strip().lower() for c in self.choices]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate choice ids inside one scenario")
        if len(labels) != len(set(labels)):
            raise ValueError("two choices in one scenario share the same label")
        return self


class Condition(_Strict):
    """Exactly one of tag / pathway / tradeoff / all / any / not."""

    tag: TagKey | None = None
    pathway: PathwayKind | None = None
    tradeoff: TagKey | None = None
    all: list["Condition"] | None = Field(default=None, min_length=1)
    any: list["Condition"] | None = Field(default=None, min_length=1)
    not_: "Condition | None" = Field(default=None, alias="not")

    @model_validator(mode="after")
    def _exactly_one_operator(self) -> "Condition":
        used = [
            name
            for name in ("tag", "pathway", "tradeoff", "all", "any", "not_")
            if getattr(self, name) is not None
        ]
        if len(used) != 1:
            raise ValueError(f"a condition needs exactly one operator, got {used or 'none'}")
        return self


Condition.model_rebuild()


class RuleOutput(_Strict):
    type: OutputType
    ref: Text


class Rule(_Strict):
    id: Slug
    condition: Condition
    output: RuleOutput
    reason: Text
    priority: int = Field(ge=0, le=1000)
    evidence_ids: list[Slug] = Field(default_factory=list)


class Evidence(_Strict):
    """PRD section 14: every evidence record stores these nine fields (plus licence)."""

    id: Slug
    publisher: Text
    title: Text
    url: Text
    published_on: Text  # YYYY, YYYY-MM or YYYY-MM-DD; checked in validate_seed.py
    accessed_on: Text  # YYYY-MM-DD; checked in validate_seed.py
    finding: Text
    geographic_scope: Text
    evidence_class: EvidenceClass
    limitations: Text
    licence: str | None = None


class Task(_Strict):
    id: Slug
    description: Text
    classification: Classification
    rationale: Text
    skills: list[Text] = Field(min_length=1)
    evidence_ids: list[Slug] = Field(min_length=1)


class PathwayContent(_Strict):
    kind: PathwayKind
    description: Text
    opportunities: list[Text] = Field(min_length=1)
    trade_offs: list[Text] = Field(min_length=1)
    skills_to_build: list[Text] = Field(min_length=1)
    next_steps: list[Text] = Field(min_length=2, max_length=4)  # PRD: 2 to 4 practical steps
    #: Optional. Pathway text with no evidence is rendered as "Suggested by FUTUREPRINT",
    #: never as "What the research says".
    evidence_ids: list[Slug] = Field(default_factory=list)


class Seed(_Strict):
    content_version: ContentVersion
    occupation: Occupation
    tags: Tags
    scenarios: list[Scenario] = Field(min_length=1)
    pathways: list[PathwayContent] = Field(min_length=3, max_length=3)
    rules: list[Rule] = Field(min_length=1)
    evidence: list[Evidence] = Field(min_length=1)
    tasks: list[Task] = Field(min_length=1)

    @model_validator(mode="after")
    def _all_three_pathways_once(self) -> "Seed":
        kinds = sorted(p.kind for p in self.pathways)
        if kinds != sorted(PATHWAY_ORDER):
            raise ValueError(f"pathways must be exactly adapt, transform, discover; got {kinds}")
        return self




def dominant_pathway(weights: dict[str, int]) -> str:
    """Highest weight wins; ties break in PATHWAY_ORDER (``max`` keeps the first maximum)."""
    return max(PATHWAY_ORDER, key=lambda p: weights.get(p, 0))


def secondary_pathway(weights: dict[str, int]) -> str | None:
    """Second-highest pathway with a positive weight, else None (useful for 'other pathways')."""
    ranked = sorted(PATHWAY_ORDER, key=lambda p: (-weights.get(p, 0), PATHWAY_ORDER.index(p)))
    return ranked[1] if weights.get(ranked[1], 0) > 0 else None


def condition_holds(
    cond: Condition, weights: dict[str, int], caps: frozenset[str], trade: frozenset[str]
) -> bool:
    if cond.tag is not None:
        return cond.tag in caps
    if cond.pathway is not None:
        return dominant_pathway(weights) == cond.pathway
    if cond.tradeoff is not None:
        return cond.tradeoff in trade
    if cond.all is not None:
        return all(condition_holds(c, weights, caps, trade) for c in cond.all)
    if cond.any is not None:
        return any(condition_holds(c, weights, caps, trade) for c in cond.any)
    assert cond.not_ is not None
    return not condition_holds(cond.not_, weights, caps, trade)


def iter_atoms(cond: Condition) -> Iterator[tuple[str, str]]:
    """Yield ('tag'|'pathway'|'tradeoff', value) for every leaf, however deeply nested."""
    if cond.tag is not None:
        yield "tag", cond.tag
    elif cond.pathway is not None:
        yield "pathway", cond.pathway
    elif cond.tradeoff is not None:
        yield "tradeoff", cond.tradeoff
    else:
        for child in (cond.all or cond.any or ([cond.not_] if cond.not_ else [])):
            yield from iter_atoms(child)


def required_pathways(cond: Condition) -> frozenset[str]:
    """Pathways that MUST be dominant for the condition to hold.

    ``all`` unions its children, ``any`` intersects them (a pathway is only required if
    every branch demands it) and ``not`` requires nothing. More than one required pathway
    means the rule can never fire.
    """
    if cond.pathway is not None:
        return frozenset({cond.pathway})
    if cond.all is not None:
        out: frozenset[str] = frozenset()
        for child in cond.all:
            out |= required_pathways(child)
        return out
    if cond.any is not None:
        sets = [required_pathways(c) for c in cond.any]
        return frozenset.intersection(*sets) if sets else frozenset()
    return frozenset()


# --------------------------------------------------------------------------- cross references


def cross_reference_problems(seed: Seed) -> list[str]:
    """Referential integrity. Returns every problem, each naming the offending id."""
    problems: list[str] = []

    def dupes(label: str, ids: list[str]) -> None:
        seen: set[str] = set()
        for i in ids:
            if i in seen:
                problems.append(f"duplicate {label} id '{i}'")
            seen.add(i)

    dupes("scenario", [s.id for s in seed.scenarios])
    dupes("choice", [c.id for s in seed.scenarios for c in s.choices])
    dupes("rule", [r.id for r in seed.rules])
    dupes("evidence", [e.id for e in seed.evidence])
    dupes("task", [t.id for t in seed.tasks])

    scenario_ids = {s.id for s in seed.scenarios}
    caps, trade = set(seed.tags.capabilities), set(seed.tags.tradeoffs)
    evidence_ids = {e.id for e in seed.evidence}

    for s in seed.scenarios:
        for c in s.choices:
            nxt = c.next_scenario_id
            if nxt is not None and nxt not in scenario_ids:
                problems.append(f"choice '{c.id}': next_scenario_id '{nxt}' does not exist")
            if nxt == s.id:
                problems.append(f"choice '{c.id}': next_scenario_id points back at its own scenario")
            for t in c.signals.capabilities:
                if t not in caps:
                    problems.append(f"choice '{c.id}': unknown capability tag '{t}'")
            for t in c.signals.tradeoffs:
                if t not in trade:
                    problems.append(f"choice '{c.id}': unknown tradeoff tag '{t}'")

    for r in seed.rules:
        for kind, value in iter_atoms(r.condition):
            if kind == "tag" and value not in caps:
                problems.append(f"rule '{r.id}': condition uses unknown capability tag '{value}'")
            if kind == "tradeoff" and value not in trade:
                problems.append(f"rule '{r.id}': condition uses unknown tradeoff tag '{value}'")
        for ev in r.evidence_ids:
            if ev not in evidence_ids:
                problems.append(f"rule '{r.id}': unknown evidence id '{ev}'")

    for t in seed.tasks:
        for ev in t.evidence_ids:
            if ev not in evidence_ids:
                problems.append(f"task '{t.id}': unknown evidence id '{ev}'")
    for p in seed.pathways:
        for ev in p.evidence_ids:
            if ev not in evidence_ids:
                problems.append(f"pathway '{p.kind}': unknown evidence id '{ev}'")

    return problems


# --------------------------------------------------------------------------- loading


class SeedFormatError(ValueError):
    """The file is not valid JSON, or has duplicate keys."""


class SeedValidationError(Exception):
    """Structural or referential problems. ``problems`` lists all of them."""

    def __init__(self, problems: list[str]):
        super().__init__("\n".join(problems))
        self.problems = problems


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            # json.load keeps the LAST duplicate silently; a repeated "tags" or choice id
            # would otherwise overwrite content without anyone noticing.
            raise SeedFormatError(f"duplicate JSON key '{key}'")
        out[key] = value
    return out


def load_json_strict(path: str | Path) -> Any:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh, object_pairs_hook=_reject_duplicate_keys)


def _loc_to_path(loc: tuple[Any, ...]) -> str:
    out = ""
    for part in loc:
        out += f"[{part}]" if isinstance(part, int) else f".{part}"
    return out.lstrip(".")


def _nearest_id(raw: Any, loc: tuple[Any, ...]) -> str | None:
    """Walk the raw JSON along ``loc`` and return the closest enclosing ``id``."""
    node, last = raw, None
    for part in loc:
        try:
            node = node[part]
        except (KeyError, IndexError, TypeError):
            break
        if isinstance(node, dict) and isinstance(node.get("id"), str):
            last = node["id"]
    return last


def format_validation_error(exc: ValidationError, raw: Any) -> list[str]:
    lines = []
    for err in exc.errors(include_url=False):
        loc = tuple(err["loc"])
        ident = _nearest_id(raw, loc)
        where = _loc_to_path(loc) or "<root>"
        suffix = f" (id '{ident}')" if ident else ""
        lines.append(f"{where}{suffix}: {err['msg']}")
    return lines


def load_seed(raw: Any) -> Seed:
    """Parse + validate. Raises SeedValidationError with ALL problems, never just the first."""
    try:
        seed = Seed.model_validate(raw)
    except ValidationError as exc:
        raise SeedValidationError(format_validation_error(exc, raw)) from exc
    problems = cross_reference_problems(seed)
    if problems:
        raise SeedValidationError(problems)
    return seed