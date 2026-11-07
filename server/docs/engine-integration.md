# Scenario engine integration guide

**For:** Person 3 (scenario and report engine owner) and backend reviewers.
**Status (2026-11-07):** the backend is ready to accept the real engine. Until it arrives, a clearly labelled reference stand-in (`app/engine/reference.py`) runs in development only.

The engine stays yours. The backend never reimplements engine logic. It loads your module, gives it plain data, checks what comes back, and handles everything to do with HTTP, the database, locking and persistence.

## 1. How the engine is loaded

At start-up, `create_app()` calls `app.engine.adapter.load_engine()`:

1. It reads `SCENARIO_ENGINE_MODULE`, for example `engine_core.scenario`. If the variable is empty, it falls back to the reference stand-in **only if `ALLOW_REFERENCE_ENGINE` permits it** (see section 5).
2. It imports the module. Any import-time error stops start-up with a readable `ConfigError`.
3. It checks the four functions exist and can be called with the agreed number of positional arguments.
4. It checks the optional attributes, if present: `ENGINE_VERSION` must be a `str`, and `InvalidChoiceError` must be an `Exception` subclass.
5. It smoke-tests `start_state()`, which must return a JSON-serialisable `dict`.
6. It logs `engine_loaded`, or logs a warning `engine_reference_in_use` for the stand-in.

If any step fails, the application does not start.

## 2. Required functions (signatures are fixed)

```python
def start_state() -> dict: ...
def apply_choice(content: dict, state: dict, current_scenario_id: str, choice_id: str) -> StepResult: ...
def present_scenario(content: dict, scenario_id: str, state: dict) -> dict: ...
def generate_report(content: dict, occupation_slug: str, choices: list[dict], state: dict) -> dict: ...
```

Rules:
- **Pure and deterministic.** No Flask, no SQLAlchemy, no HTTP, no files, no clock, no randomness. The same inputs must give the same output.
- **No mutation of arguments.** The adapter passes deep copies, but the conformance check reports any mutation.
- **Fast and bounded.** The backend calls `apply_choice` while it holds a database row lock on the session.
- **JSON in, JSON out.** Return plain dicts and lists of `str`, `int`, `float`, `bool` and `None`. Dataclasses and NamedTuples are accepted for `StepResult` and converted.

### Optional module attributes (recommended)

```python
ENGINE_VERSION = "1.0.0"          # recorded on sessions and report snapshots

class InvalidChoiceError(Exception):
    """Raise from apply_choice to reject a choice, e.g. one locked by the current state."""
```

## 3. Input and output structures

### `content` (built by the backend from PostgreSQL, one occupation per call)

```python
{
  "schema_version": 1,                       # bumped if this structure changes
  "content_version": "2026.11.07+589cc455",
  "occupation": {"id": "<uuid>", "slug": "software-developer", "name": "Software Developer"},
  "start_scenario_id": "<uuid>",
  "scenarios": {
    "<scenario uuid>": {
      "id": "<uuid>", "key": "dev-1", "title": "...", "narrative": "...",
      "task": {"slug": "design-and-build-software", "title": "...", "exposure_level": "medium"} | None,
      "choices": [
        {"id": "<uuid>", "key": "a", "label": "...", "description": "...", "feedback": "...",
         "pathway_kind": "adapt" | "transform" | "discover" | None,
         "effects": {"ai_fluency": 2, "judgement": 1},     # integer deltas from seed data
         "next_scenario_id": "<uuid>" | None}               # seed-data suggestion
      ]
    }
  },
  "pathways": [{"id", "slug", "kind", "title", "summary", "steps", "target_roles", "skills": [{"slug", "name"}]}]
}
```

IDs are deterministic UUIDs derived from the seed keys, so they stay stable across reloads. The `key` fields are human-readable and are the safer values to use in logic.

### `state`

`state` is owned entirely by the engine. The backend stores whatever `start_state()` and `apply_choice()` return, as JSONB, and passes it back unchanged. It is also returned to the frontend as `session.state`, so don't put anything in it that users shouldn't see.

### `StepResult` returned by `apply_choice`

```python
{"state": dict, "next_scenario_id": str | None, "completed": bool, "feedback": str | None}
```

| Field | Rule enforced by the adapter |
|---|---|
| `state` | Required dict, JSON-serialisable |
| `completed=True` | `next_scenario_id` must be `None` |
| `completed=False` | `next_scenario_id` must be a different scenario in `content["scenarios"]` |
| `feedback` | Optional; when `None`, the backend falls back to the choice's seed `feedback` |

### `present_scenario` return value

```python
{"id": "<the requested scenario_id>", "title": str, "narrative": str,
 "choices": [{"id": "<choice uuid from content>", "label": str, "description": str}, ...],
 # any extra keys are passed through to the API unchanged
}
```

At least one choice is required, and every choice `id` must belong to that scenario in `content`. Leave out choices that are locked for the current state. The frontend renders this object directly as `session.current_scenario`.

### `generate_report`

`choices` is the ordered list of accepted choices:

```python
[{"step_index": 1, "scenario_id": "<uuid>", "choice_id": "<uuid>"}, ...]
```

Return a JSON-serialisable `dict`. The backend stores it, unchanged, under `report.insights` in an immutable snapshot, alongside the journey, evidence, pathways, content version and engine identity.

## 4. What the backend guarantees and enforces

| Concern | Where it is handled |
|---|---|
| The choice belongs to the session's current scenario (checked in the database before the engine is called) | `simulation_service` → `422 invalid_choice` |
| The client never supplies a scenario id; any extra field is rejected | Pydantic schema → `422 validation_error` |
| Duplicate and concurrent submissions | Row lock plus unique constraints → `409 duplicate_choice` |
| The engine rejects a choice (`InvalidChoiceError`) | `422 choice_rejected`; nothing is saved |
| The engine raises any other exception or breaks the contract | `500 engine_error`; nothing is saved; details are logged, never returned |
| A session created by a different engine or version | `409 session_engine_mismatch`; the user starts a new session |
| Reports | Idempotent per session, immutable (database trigger), separate share token |

Sessions record `engine_id` (`module` or `module@ENGINE_VERSION`). **Changing `ENGINE_VERSION` invalidates in-progress sessions** (they get `409 session_engine_mismatch`). Reports that were already generated stay readable. Bump the version whenever the `state` format changes.

## 5. Reference stand-in: development only

`app/engine/reference.py` is **not** the FUTUREPRINT engine. It follows the seed data's `next_scenario_id` and `effects` and counts which pathway kind each choice leans towards. API responses show `session.engine.is_reference: true` while it is active, and `GET /api/v1/health/ready` reports it too.

| `APP_ENV` | `ALLOW_REFERENCE_ENGINE` unset | `true` | `false` |
|---|---|---|---|
| development / testing | stand-in allowed | allowed | refused |
| production | **refused (app won't start)** | allowed (deliberate override) | refused |

In production, set `SCENARIO_ENGINE_MODULE` to the real engine and leave `ALLOW_REFERENCE_ENGINE` unset.

## 6. Integrating the real engine, step by step

1. Put the package somewhere importable from `server/`, for example `server/engine_core/` with `__init__.py` and `scenario.py`. It must not import `app.*`, Flask or SQLAlchemy.
2. Configure it in `server/.env`:
   ```
   SCENARIO_ENGINE_MODULE=engine_core.scenario
   ```
3. Run the conformance check against the real seed data:
   ```bash
   cd server
   flask db upgrade && flask seed load
   flask engine check                          # all occupations
   flask engine check --occupation accountant  # one occupation
   ```
   It walks every path the engine offers and reports:
   - contract violations
   - non-determinism
   - mutated arguments
   - presented choices that are then rejected
   - loops, meaning paths longer than `--max-steps` (default 50)
4. Run the backend test suite (see section 7). The tests use their own fixture engines and don't depend on your engine's internals.
5. Start the app and check `GET /api/v1/health/ready` shows `"engine": {"is_reference": false, ...}`.

## 7. Running the integration tests

```bash
cd server
export TEST_DATABASE_URL=postgresql://futureprint:<password>@localhost:5432/futureprint_test
pytest tests/test_engine_integration.py tests/test_engine_adapter.py tests/test_simulation.py tests/test_reports.py
pytest            # full suite
```

`tests/fixtures/contract_engine.py` is a second, independent fixture engine. It uses a different state format, a version and a locked choice. It proves the backend relies only on the contract. It is test-only and is not product logic.

## 8. Decisions needed from Person 3

1. **Transitions:** should the engine follow the seed data's `next_scenario_id`, or compute transitions itself? The backend supports both; the content has to match whichever you choose.
2. **Effects vocabulary:** are the seed `effects` traits (`ai_fluency`, `human_connection`, `technical_depth`, `adaptability`, `judgement`, `learning_mindset`) what your scoring needs? Seed data is owned by Person 2 and can be changed to match.
3. **Content fields:** does the engine need anything beyond `content` schema version 1, such as occupation exposure gradient, task lists or skills? Adding fields is backward compatible.
4. **Locked choices:** will you use `InvalidChoiceError` and hide locked choices in `present_scenario`?
5. **Report output:** what shape will `generate_report` return? The frontend renders `report.insights`, so this needs agreeing with the frontend team.
6. **Versioning:** set `ENGINE_VERSION`, and bump it when the `state` format changes.
7. **Packaging:** the module path for `SCENARIO_ENGINE_MODULE`, and any third-party dependencies (they need adding to `server/requirements.txt`).
