"""Request payload schemas. Unknown fields are rejected everywhere."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)


class CreateSessionRequest(StrictRequest):
    occupation_slug: Slug


class SubmitChoiceRequest(StrictRequest):
    """Only the choice is accepted. The current scenario always comes from the
    authenticated server-side session, never from the client."""

    choice_id: uuid.UUID


class EvidenceQuery(StrictRequest):
    region: Literal["kenya", "africa", "global", "outside_africa"] | None = None
    category: (
        Literal[
            "ai_exposure_research",
            "labour_statistics",
            "employment_projection",
            "productivity_study",
            "workforce_event",
            "policy_guidance",
            "sector_report",
        ]
        | None
    ) = None


class InsightRequest(StrictRequest):
    occupation_slug: Slug
    task_slug: Slug | None = None
    question: Annotated[str, StringConstraints(min_length=3, max_length=4000)] | None = None
