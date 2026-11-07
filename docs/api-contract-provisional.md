# FUTUREPRINT API contract — PROVISIONAL (frontend assumption)

> **Status: NOT AGREED.** No API contract existed in the repository when the frontend was started.
> This is the interface the frontend currently codes against (`client/src/types/api.ts`) and that
> mock mode implements. It needs confirmation or correction from **Person 2 (backend)**,
> **Person 3 (research)** and **Person 5 (recommendations)**. Once frozen, update
> `client/src/types/api.ts` first; the UI only consumes those types.

## Conventions
- Base path `/api/v1`, JSON in and out.
- Auth: `Authorization: Bearer <token>`, where the token is returned by `POST /sessions`. The client keeps it in
  `sessionStorage` (PRD MVP approach) and never puts it in URLs or logs.
- Every non-2xx response uses the error envelope:
  ```json
  { "error": { "code": "STALE_STEP", "message": "Human-readable text", "details": {} } }
  ```

## Endpoints

| Method | Path | Auth | Success | Body / notes |
|---|---|---|---|---|
| GET | `/occupations` | – | 200 `{ items: Occupation[] }` | |
| POST | `/sessions` | – | 201 `{ token, session: Session }` | `{ occupationId }` |
| GET | `/sessions/current` | ✓ | 200 `Session` | used to resume after a refresh |
| POST | `/sessions/current/choices` | ✓ | 200 `Session` (next state) | `{ scenarioId, optionId, step }` |
| POST | `/sessions/current/report` | ✓ | 200 `Report` | only once the session is completed |

`Session`: `{ id, status: 'in_progress'|'completed', occupation, currentStep, totalSteps, currentScenario: Scenario|null, choices: Choice[], expiresAt }`

`Scenario`: `{ id, step, title, prompt, context?, options: { id, label, description, pathway: 'adapt'|'transform'|'discover' }[] }`

`Report`: `{ sessionId, generatedAt, occupation, choices, pathway: { id, summary }, research: { findings: { id, statement, source: { id, title, publisher, year?, url } }[], limitations: string[] }, suggestions: { id, category, title, description, reason }[] }`

`category` ∈ `skill | transferable_capability | career_direction | learning_activity | next_step`.

## Error codes the UI handles

| Code | HTTP | Frontend behaviour |
|---|---|---|
| `SESSION_NOT_FOUND` | 401 | clear token, show "start a journey" |
| `SESSION_EXPIRED` | 401 | clear token, show "your journey has expired" |
| `STALE_STEP` | 409 | show notice and re-fetch `GET /sessions/current` |
| `SESSION_COMPLETED` | 409 | shows the "Futureprint ready" state |
| `SESSION_INCOMPLETE` | 409 | on `/report`: "finish your decisions" |
| `VALIDATION_ERROR` | 422 | inline message |
| 5xx / network | – | retry (queries auto-retry twice for cold starts) |

## Research endpoints (provisional, added for the Observatory and Task Scanner)

| Method | Path | Success |
|---|---|---|
| GET | `/observatory/events` | 200 `{ items: WorkforceEvent[], industries: string[] }` |
| GET | `/occupations/:id/tasks` | 200 `TaskBreakdown` · 404 if the occupation is unknown |

`WorkforceEvent`: `{ id, date (YYYY-MM[-DD]), title, summary, industry, organisation?, eventType: adoption|restructuring|new_role|policy|training, evidenceLevel: official_statistics|peer_reviewed|industry_report|news_report, source }`

`TaskBreakdown`: `{ occupation, tasks: { id, name, classification: routine|augmented|human_led|emerging, explanation, skills: string[], source? }[], limitations: string[] }`

**Person 3:** please confirm or replace these classifications and evidence levels. The labels shown to visitors live in `client/src/lib/evidence.ts`.

## Questions for the team
1. **Person 2:** Is the step number in the choice body acceptable for stale detection, or would you prefer an `If-Match`/version field or an `Idempotency-Key` header?
2. **Person 2:** What is the session TTL, and is `expiresAt` returned?
3. **Person 2:** Is the frontend served from the same origin as the API? If not, CORS must allow the `Authorization` header.
4. **Person 3:** Confirm the finding and source shapes, and whether limitations are per finding or per report.
5. **Person 5:** Confirm the suggestion categories, and that every suggestion includes a `reason`.
6. **Person 4:** Is it always exactly 3 steps, and can there be more than 3 options per scenario? The UI supports any number of steps (from `totalSteps`) and any number of options.
