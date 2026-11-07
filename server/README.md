# FUTUREPRINT backend

A Flask 3 / PostgreSQL 16 REST API for FUTUREPRINT: occupation exploration, evidence transparency, anonymous scenario simulation and shareable career reports.

- **Architecture:** a modular monolith. Routes (`app/api`) call services (`app/services`), services call repositories (`app/repositories`), and repositories query PostgreSQL. Only repositories run database queries.
- **Validation:** Pydantic v2 validates every request body and query string, and unknown fields are rejected.
- **Scenario engine:** pure Python functions behind an adapter (`app/engine`). No Flask or SQL inside the engine.
- **Content:** curated, version-controlled JSON in [`seed_data/`](seed_data/README.md), loaded into PostgreSQL by an idempotent command.
- **Anonymous by default:** no accounts. Sessions use bearer tokens, and only SHA-256 hashes of them are stored.

```
server/
├── app/
│   ├── api/            # HTTP routes (blueprint /api/v1)
│   ├── services/       # use cases: occupations, sessions, simulation, reports, insights
│   ├── repositories/   # all database access
│   ├── models/         # SQLAlchemy 2.x typed models
│   ├── schemas/        # Pydantic request schemas
│   ├── engine/         # scenario-engine contract, adapter, reference stand-in
│   ├── seed/           # seed schemas, validation and loader
│   ├── config.py       # environment configuration (validated at start-up)
│   ├── errors.py       # JSON error handling
│   ├── logging_config.py
│   └── security.py     # token generation and hashing
├── migrations/         # Alembic migrations (Flask-Migrate)
├── seed_data/          # curated research dataset + provenance README
├── tests/              # pytest suite (real PostgreSQL)
└── wsgi.py
```

## Quick start

```bash
# From the repository root
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements-dev.txt

cd server
cp .env.example .env          # then edit DATABASE_URL, TEST_DATABASE_URL and SECRET_KEY
flask db upgrade              # create the schema
flask seed load               # load the research dataset
flask run --port 5000         # http://localhost:5000/api/v1/health
```

The Flask CLI reads `server/.flaskenv` (`FLASK_APP=app:create_app`) and `server/.env`. Run `flask` commands from inside `server/`.

## Database setup

Create a role and two databases, one for development and one for tests, as the `postgres` superuser. The `--pwprompt` flag keeps the password out of your shell history.

```bash
sudo -u postgres createuser --pwprompt futureprint
sudo -u postgres createdb -O futureprint futureprint
sudo -u postgres createdb -O futureprint futureprint_test
```

Then set these in `server/.env`:

```
DATABASE_URL=postgresql://futureprint:<password>@localhost:5432/futureprint
TEST_DATABASE_URL=postgresql://futureprint:<password>@localhost:5432/futureprint_test
```

URLs beginning `postgresql://` or `postgres://` are automatically switched to the installed psycopg 3 driver.

## Configuration

All settings are environment variables, validated at start-up; see [`.env.example`](.env.example). The app refuses to start, with a clear message, if a value is invalid. Key rules:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Required. Must be PostgreSQL. |
| `SECRET_KEY` | Required. At least 32 characters in production. It also derives report share tokens, so rotating it breaks existing share links. |
| `CORS_ORIGINS` | Comma-separated frontend origins. `*` is rejected in production. |
| `SESSION_TTL_HOURS` | Default 72. Extended each time a choice is submitted. |
| `SCENARIO_ENGINE_MODULE` | Import path of the scenario engine: `app.services.scenario_engine.plugin`. When empty, the reference stand-in is used, but only where it is allowed. |
| `ALLOW_REFERENCE_ENGINE` | When unset, the stand-in is allowed in development and testing and **refused in production** (the app won't start). Set `true` or `false` to override. |
| `AI_INSIGHTS_ENABLED` | Default `false`. When `true`, `OPENAI_API_KEY` and `OPENAI_MODEL` are required. |

## Migrations

```bash
flask db upgrade                       # apply all migrations
flask db downgrade base                # roll everything back (development only)
flask db migrate -m "describe change"  # autogenerate after editing models; always review the file
```

- `0001_initial_schema` creates all tables: content, sessions, choices, reports and AI usage. It also creates a trigger that makes report snapshots immutable.
- `0002_session_engine_id` adds `anonymous_sessions.engine_id`, recording which engine created each session's state. Existing rows are backfilled to `app.engine.reference`.

## Seed data

```bash
flask seed validate    # schema + cross-reference checks, no database writes
flask seed load        # validate, then upsert everything in one transaction
```

Loading is idempotent: deterministic UUIDs plus `INSERT ... ON CONFLICT DO UPDATE` mean re-running updates rows instead of duplicating them. Provenance, methodology, known gaps and the update procedure are in [`seed_data/README.md`](seed_data/README.md).

## Running tests

Tests run against real PostgreSQL. They rely on behaviour SQLite cannot reproduce: row locks, JSONB, partial unique indexes and the report-immutability trigger.

```bash
cd server
export TEST_DATABASE_URL=postgresql://futureprint:<password>@localhost:5432/futureprint_test
pytest                       # 1008 tests (893 of them in tests/simulator, no database needed)
pytest --cov=app             # with coverage
pytest tests/test_engine_integration.py   # scenario-engine integration tests only
```

To check the configured scenario engine against the loaded seed data, run `flask engine check` (see [docs/engine-integration.md](docs/engine-integration.md)).

Safety guard: the suite refuses to run unless the database name ends in `_test`. It drops and rebuilds that database's `public` schema from the migrations, so **never point `TEST_DATABASE_URL` at a database you care about**.

---

## API reference (`/api/v1`)

Every response is JSON. Every error has this shape:

```json
{"error": {"code": "invalid_choice", "message": "The choice does not belong to the current scenario.", "details": [], "request_id": "4522965705654e96b89478bc38010f77"}}
```

Each response carries an `X-Request-ID` header. Send your own (8–64 characters from `[A-Za-z0-9-]`) to correlate frontend and backend logs.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness and database check |
| GET | `/health/ready` | none | Readiness: database, migrations and content loaded |
| GET | `/occupations` | none | List occupations |
| GET | `/occupations/{slug}` | none | Occupation detail: tasks, skills, exposure, pathways, evidence, events |
| GET | `/evidence?region=&category=` | none | List evidence sources |
| GET | `/evidence/{key}` | none | Source detail and where it is used |
| GET | `/workforce-events` | none | Verified workforce events |
| GET | `/methodology` | none | Methodology, glossary and known gaps |
| POST | `/sessions` | none | Start an anonymous simulation session |
| GET | `/sessions/current` | Bearer | Resume a session (for example after a page refresh) |
| POST | `/sessions/current/choices` | Bearer | Submit a choice |
| POST | `/sessions/current/report` | Bearer | Generate the report (idempotent) |
| GET | `/reports/{share_token}` | none | Read-only shared report |
| GET | `/insights/status` | none | Whether AI insights are enabled |
| POST | `/insights/explain` | Bearer | Optional evidence-grounded AI explanation |

### Health

```http
GET /api/v1/health          → 200 {"status": "ok", "version": "0.1.0", "database": "ok"}
                              503 {"status": "degraded", "version": "0.1.0", "database": "unavailable"}
GET /api/v1/health/ready    → 200 {"status": "ready", "checks": {"database": "ok", "migrations": "ok", "content": "ok"},
                                    "engine": {"is_reference": false, "version": "1.0.0"}}
```

### Occupations

```http
GET /api/v1/occupations
```
```json
{
  "content_version": "2026.11.07+589cc455",
  "occupations": [
    {
      "slug": "customer-service-agent",
      "name": "Customer Service / Contact Centre Agent",
      "category": "Clerical support and business process outsourcing",
      "summary": "Answers customer questions ...",
      "isco_08_code": "4222",
      "exposure": {"gradient": "gradient_3", "gradient_label": "Exposed: Gradient 3 (significant exposure, high task variability)", "ilo_mean_score": 0.58},
      "task_count": 6,
      "pathway_kinds": ["adapt", "discover", "transform"],
      "simulation_available": true
    }
  ]
}
```

```http
GET /api/v1/occupations/customer-service-agent     → 200 | 404 occupation_not_found
```
Response keys:
- `occupation`: overview, responsibilities, `kenya_context`, `limitations`, and `exposure` with gradient, ILO score and summary.
- `tasks[]`: each task has `exposure.level`, `exposure.ilo_task_score`, `likely_change`, `transformation_note`, `skills` and `evidence`.
- `skills[]`: each skill includes its `importance`.
- `pathways[]`: Adapt, Transform and Discover pathways, each with `steps`, `target_roles`, `skills` and `evidence`.
- `evidence[]`: sources linked to the occupation, each with a `relevance` note.
- `workforce_events[]`.
- `sources[]`: every source cited on the page.
- `simulation`: whether a simulation exists, and its scenario count.

Every evidence item includes `region` and `is_african_evidence`, so the UI can label evidence from outside Africa.

### Sessions and simulation

**Start a session.** The raw token is returned **once**. Store it client-side (for example in `sessionStorage`) and send it as `Authorization: Bearer <token>`.

```http
POST /api/v1/sessions
Content-Type: application/json

{"occupation_slug": "software-developer"}
```
```json
201 Created
{
  "session_token": "fps_3J0x...43 chars",
  "token_type": "Bearer",
  "expires_at": "2026-11-10T12:38:54+00:00",
  "session": {
    "status": "active",
    "occupation": {"slug": "software-developer", "name": "Software Developer"},
    "content_version": "2026.11.07+589cc455",
    "engine": {"name": "app.engine.reference", "version": null, "is_reference": true},
    "step_count": 0,
    "current_scenario": {
      "id": "1b0c...uuid",
      "title": "Your team adopts an AI coding assistant",
      "narrative": "You are a junior developer at a Nairobi start-up ...",
      "task": {"slug": "design-and-build-software", "title": "Design and build software systems", "exposure_level": "medium"},
      "step_number": 1,
      "choices": [{"id": "7f2e...uuid", "label": "Use it, but review everything", "description": "..."}]
    },
    "state": {"step": 0, "pathway_affinity": {"adapt": 0, "transform": 0, "discover": 0}, "traits": {}, "visited_scenarios": []},
    "history": [],
    "report_available": false,
    "report_generated": false,
    "created_at": "...", "expires_at": "...", "completed_at": null
  }
}
```
Errors: `404 occupation_not_found`, `422 validation_error` (bad slug or unknown field), `415` (body is not JSON).

**Resume.** `GET /api/v1/sessions/current` returns `{"session": {...}}` in the same shape. Errors: `401 invalid_token`, `401 session_expired`, `409 session_engine_mismatch` (the session was started under a different engine or engine version: start a new session), and `500 engine_error`.

**Submit a choice.** Send **only** `choice_id`. The server works out the current scenario from the session; a `scenario_id` field is rejected.

```http
POST /api/v1/sessions/current/choices
Authorization: Bearer fps_...
Content-Type: application/json

{"choice_id": "7f2e...uuid"}
```
```json
200 OK
{
  "accepted_choice": {"id": "7f2e...", "label": "Use it, but review everything", "step_index": 1, "feedback": "AI speeds up coding, but ..."},
  "completed": false,
  "session": {"...": "updated session, next current_scenario, history"}
}
```

| Status | Code | Meaning |
|---|---|---|
| 422 | `invalid_choice` | The choice is not one of the current scenario's choices |
| 409 | `duplicate_choice` | This choice was already accepted (double click, retry or concurrent request) |
| 409 | `session_completed` | The simulation is finished |
| 422 | `choice_rejected` | The engine rejected the choice under its own rules, for example a locked choice (nothing is saved) |
| 409 | `session_engine_mismatch` | The session was started under a different engine or version; start a new session |
| 401 | `invalid_token` / `session_expired` | Missing, unknown or expired token |
| 500 | `engine_error` | The scenario engine failed or broke the contract (nothing is saved) |

Concurrency: the session row is locked (`SELECT ... FOR UPDATE`) while a choice is processed, and unique constraints on `user_choices` (one row per step and per scenario) act as a backstop. Of several simultaneous identical requests, exactly one succeeds.

### Reports

```http
POST /api/v1/sessions/current/report
Authorization: Bearer fps_...
```
Returns `201` the first time and `200` with the **same** report and share token afterwards. Errors: `409 session_not_completed`, `409 session_engine_mismatch` (only when a *new* report would need a different engine; existing reports are always returned), and `422 unexpected_fields` if the body contains any fields.

```json
{
  "created": true,
  "report_id": "uuid",
  "created_at": "...",
  "share_token": "43-char token",
  "share_path": "/api/v1/reports/<share_token>",
  "report": {
    "schema_version": 1,
    "content_version": "2026.11.07+589cc455",
    "occupation": {"slug": "...", "name": "...", "exposure": {"...": "..."}},
    "journey": [{"step_index": 1, "scenario_title": "...", "choice_label": "...", "pathway_kind": "adapt", "feedback": "..."}],
    "final_state": {"...": "..."},
    "insights": {"pathway_affinity": {"adapt": 1, "transform": 1, "discover": 1}, "leading_pathway_kind": "adapt", "recommended_pathways": ["..."], "strengths_developed": ["..."]},
    "pathways": ["..."],
    "evidence": ["..."],
    "disclaimer": "This FUTUREPRINT report reflects the choices you made in an illustrative simulation. It is not a prediction ..."
  }
}
```

```http
GET /api/v1/reports/{share_token}   → 200 {"report_id", "created_at", "content_version", "integrity_sha256", "report"} | 404 report_not_found
```
The share token is separate from the session token and reveals nothing about the session. Shared-report responses send `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`. A suggested frontend route is `/r/<share_token>`.

### Evidence and methodology

```http
GET /api/v1/evidence?region=kenya                     # region: kenya | africa | global | outside_africa
GET /api/v1/evidence?category=ai_exposure_research
GET /api/v1/evidence/ilo-wp140-genai-exposure-2025    # findings, limitations, retrieval date, used_by[]
GET /api/v1/workforce-events
GET /api/v1/methodology                               # glossary, exposure scale, known gaps
```

### AI insights (optional)

`GET /api/v1/insights/status` returns `{"enabled": false, ...}` by default. When enabled:

```http
POST /api/v1/insights/explain
Authorization: Bearer fps_...
{"occupation_slug": "accountant", "task_slug": "prepare-financial-statements", "question": "Will AI replace this task?"}
```
The response contains `answer`, `evidence_sufficient`, `limitations`, `citations[]` (only keys that were supplied as evidence), `usage` and `cached`. Errors: `503 ai_insights_disabled`, `503 ai_unavailable`, `503 ai_invalid_response`, `429 ai_quota_exceeded`, `422 question_too_long`.

The model only explains curated evidence and never decides simulation outcomes. Every call is recorded in `ai_usage_records`, with tokens, estimated cost and latency.

---

## Running in production

`wsgi.py` exposes the app for a WSGI server. `gunicorn` is in `requirements.txt`:

```bash
cd server
flask db upgrade && flask seed load    # once per deploy, before starting workers
gunicorn wsgi:app --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 30
```

In production:

- Set `APP_ENV=production`, a `SECRET_KEY` of at least 32 characters, and `CORS_ORIGINS` to the deployed frontend origin(s). Wildcards are rejected.
- `SCENARIO_ENGINE_MODULE` must name the real engine. The app refuses to start with the reference stand-in.
- Point the platform health check at `/api/v1/health/ready`. It returns 503 until migrations have run and content is loaded.
- Keep `LOG_FORMAT=json` (the default) so logs stay structured and carry `request_id`.

## Scenario engine integration (for Person 3)

The full guide is in **[docs/engine-integration.md](docs/engine-integration.md)**: how the engine is loaded, the required signatures, input and output structures, error translation, the production guard, `flask engine check`, and the open decisions for Person 3.

In short:

```python
start_state() -> dict
apply_choice(content, state, current_scenario_id, choice_id) -> StepResult  # {"state", "next_scenario_id", "completed", "feedback"}
present_scenario(content, scenario_id, state) -> dict                       # {"id", "title", "narrative", "choices": [...]}
generate_report(content, occupation_slug, choices, state) -> dict
```

- Configure with `SCENARIO_ENGINE_MODULE=<module>`. Signatures and a `start_state()` smoke call are checked at start-up.
- Optional `ENGINE_VERSION` is recorded on sessions and reports. Optional `InvalidChoiceError` lets the engine reject a choice with `422 choice_rejected`.
- `app/engine/reference.py` is a **development stand-in, not the real engine**. Production refuses to start with it unless `ALLOW_REFERENCE_ENGINE=true`.

## Security notes

- Session and share tokens are 256-bit values. Only their SHA-256 hashes are stored, and the raw session token is returned once.
- All SQL goes through SQLAlchemy with bound parameters.
- Request bodies are limited to 64 KB.
- Error responses never include stack traces, SQL or configuration.
- Logs record route patterns, not raw paths (share tokens never reach the logs), and never record headers or bodies.
- CORS allows only `CORS_ORIGINS`, without credentials.
- Report rows are immutable: a database trigger enforces it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ConfigError: Invalid configuration -> SECRET_KEY: ...` | Set the variable in `server/.env` (see `.env.example`). |
| `/health/ready` reports `"content": "not_loaded"` | Run `flask seed load`. |
| `/health/ready` reports `"migrations": "pending"` | Run `flask db upgrade`. |
| `SeedConflictError` on load | You removed content that sessions or reports still reference. Restore it, or clear those sessions in development. |
| Tests exit with "name must end with '_test'" | Point `TEST_DATABASE_URL` at a dedicated `*_test` database. |
