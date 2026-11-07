# API contract gaps: client vs server

**Status:** open, needs a team decision. Nothing in the code has changed yet.
**Compared:** `client/src/types/api.ts` + `client/src/lib/api.ts` (the frontend's provisional contract, see [api-contract-provisional.md](api-contract-provisional.md)) against the implemented Flask API (`server/app/api/*`, documented in [server/README.md](../server/README.md#api-reference-apiv1)).

The frontend only works end to end in **mock mode** (`npm run dev:mock`). With `VITE_USE_MOCKS=false`, the first real request fails or returns data the UI can't read, because the two sides describe different APIs. This page lists every difference, so the owners (Person 1 frontend, Person 2 backend) can agree on one contract and change one side.

## 1. Conventions

| Topic | Client expects | Server sends |
|---|---|---|
| JSON key style | `camelCase` (`currentStep`, `expiresAt`) | `snake_case` (`step_count`, `expires_at`) |
| Error codes | `UPPER_SNAKE` (`SESSION_EXPIRED`, `STALE_STEP`) | `lower_snake` (`session_expired`, `duplicate_choice`) |
| Occupation identifier | `id` | `slug` |
| Occupation display name | `title` | `name` |
| Session status | `in_progress` \| `completed` | `active` \| `completed` (plus expiry via `expires_at`) |

**Recommendation:** keep the server's `snake_case` and lower-case codes (already implemented, tested and documented). Map them in one place on the client (`lib/api.ts`), so the UI types stay as they are.

## 2. Endpoints

| Client call (`lib/api.ts`) | Client path | Server path | Gap |
|---|---|---|---|
| `listOccupations` | `GET /occupations` → `{ items: Occupation[] }` | `GET /occupations` → `{ content_version, occupations: [...] }` | List key `items` vs `occupations`, plus the field names above |
| `createSession` | body `{ occupationId }` → `{ token, session }` | body `{ occupation_slug }` → `{ session_token, token_type, expires_at, session }` | Request field and token field names differ. The server rejects unknown fields with 422 |
| `getCurrentSession` | → `Session` | → `{ session: {...} }` | Server wraps the session in an envelope |
| `submitChoice` | body `{ scenarioId, optionId, step }` → `Session` | body `{ choice_id }` only → `{ accepted_choice, completed, session }` | The server **rejects** `scenario_id` and works out the step itself. The client's `STALE_STEP` handling maps to the server's `duplicate_choice` / `invalid_choice` |
| `createReport` | → `Report` | → `{ created, report_id, share_token, share_path, report: {...} }` | Envelope, and the report body shape differs (see §3) |
| `listWorkforceEvents` | `GET /observatory/events` | `GET /workforce-events` | Path differs |
| `getOccupationTasks` | `GET /occupations/{id}/tasks` | — | No such endpoint. Tasks are part of `GET /occupations/{slug}` |
| (not used) | — | `GET /reports/{share_token}` | Server supports shared reports. The client has no route for them yet (suggested: `/r/<share_token>`) |
| (not used) | — | `GET /evidence`, `GET /methodology`, `/insights/*` | Server-only. The Methodology page uses static content |

## 3. Session and report shapes

| Client field (`Session`) | Server equivalent |
|---|---|
| `currentStep`, `totalSteps` | `current_scenario.step_number` and `current_scenario.total_steps` (`step_count` = choices made). Both are absent once completed, because `current_scenario` is `null` |
| `currentScenario.prompt`, `.context` | `current_scenario.narrative`, `.task` |
| `currentScenario.options[]` with `pathway` | `current_scenario.choices[]`. The pathway is **not** exposed before a choice (by design: no steering) |
| `choices[]` | `history[]` |

The client `Report` expects `pathway.id`, `research.findings[]` and `suggestions[]`. The server returns `journey[]`, `insights.leading_pathway_kind`, `insights.recommended_pathways`, `pathways[]`, `evidence[]` and a `disclaimer`. The UI must show the disclaimer.

## 4. Suggested next steps

1. Person 1 and Person 2 agree that the server's documented API is the contract (or list the server changes they want instead, for example a top-level `total_steps` that survives completion).
2. Update `client/src/types/api.ts` with response types that mirror the server. Add a mapping layer in `lib/api.ts` that converts them to the current UI types, so components don't change.
3. Update `src/mocks/` to return the server's shapes, so mock mode keeps testing the real contract.
4. Mark [api-contract-provisional.md](api-contract-provisional.md) as superseded.
