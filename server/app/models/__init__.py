"""SQLAlchemy models. Importing this package registers every table on the metadata."""

from app.models.activity import AIUsageRecord, AnonymousSession, FutureprintReport, UserChoice
from app.models.content import (
    Company,
    ContentVersion,
    EvidenceLink,
    EvidenceSource,
    Occupation,
    OccupationSkill,
    Pathway,
    Scenario,
    ScenarioChoice,
    Skill,
    Task,
    TaskSkill,
    WorkforceEvent,
    pathway_skills,
    workforce_event_occupations,
)

__all__ = [
    "AIUsageRecord",
    "AnonymousSession",
    "Company",
    "ContentVersion",
    "EvidenceLink",
    "EvidenceSource",
    "FutureprintReport",
    "Occupation",
    "OccupationSkill",
    "Pathway",
    "Scenario",
    "ScenarioChoice",
    "Skill",
    "Task",
    "TaskSkill",
    "UserChoice",
    "WorkforceEvent",
    "pathway_skills",
    "workforce_event_occupations",
]
