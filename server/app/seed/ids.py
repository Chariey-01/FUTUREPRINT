"""Deterministic UUIDs for seed content.

Content identifiers are UUIDv5 values derived from natural keys, so the same
seed record always maps to the same UUID. This makes loading idempotent
(``INSERT ... ON CONFLICT (id) DO UPDATE``) and keeps ids stable across
machines, so a choice id the frontend received yesterday is still valid
after the dataset is reloaded today. Never change the namespace.
"""

from __future__ import annotations

import uuid

FUTUREPRINT_NAMESPACE = uuid.UUID("6f1d3c5e-8a0b-4f6e-9d2a-3b7c1e5f9a24")


def content_id(kind: str, *parts: str) -> uuid.UUID:
    return uuid.uuid5(FUTUREPRINT_NAMESPACE, f"{kind}:" + "/".join(parts))


def source_id(key: str) -> uuid.UUID:
    return content_id("source", key)


def skill_id(slug: str) -> uuid.UUID:
    return content_id("skill", slug)


def occupation_id(slug: str) -> uuid.UUID:
    return content_id("occupation", slug)


def task_id(occupation: str, slug: str) -> uuid.UUID:
    return content_id("task", occupation, slug)


def pathway_id(occupation: str, slug: str) -> uuid.UUID:
    return content_id("pathway", occupation, slug)


def scenario_id(occupation: str, key: str) -> uuid.UUID:
    return content_id("scenario", occupation, key)


def choice_id(occupation: str, scenario_key: str, key: str) -> uuid.UUID:
    return content_id("choice", occupation, scenario_key, key)


def company_id(slug: str) -> uuid.UUID:
    return content_id("company", slug)


def event_id(slug: str) -> uuid.UUID:
    return content_id("event", slug)
