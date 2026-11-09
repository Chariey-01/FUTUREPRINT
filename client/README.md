# FUTUREPRINT — visitor frontend

React + TypeScript + Vite + Tailwind + React Router + Framer Motion + TanStack Query.

## Run

```bash
cd client
npm install
npm run dev:mock     # full journey on in-browser mock data, no backend needed
npm run dev          # real API: set VITE_API_BASE_URL in .env.local (see .env.example)
```

Mock mode shows a "Mock mode · sample data, not real research" strip on every page.

### API contract

The client follows the Flask API in [`server/README.md`](../server/README.md#api-reference-apiv1):

- **`src/types/server.ts`**: the server's wire types (snake_case, envelopes, lower_snake error codes).
- **`src/lib/mapping.ts`**: the **only** place that translates server shapes into UI types (`src/types/api.ts`), including error codes. For example, `invalid_choice` and `duplicate_choice` become `STALE_STEP`, which re-syncs the simulator.
- **`src/mocks/`**: returns the server's exact shapes and validation, so mock mode exercises the real contract.

### Against the real backend (Docker, no local Postgres needed)

```bash
scripts/real-backend-docker.sh                                   # Postgres 16 + Flask API on :5055, seed loaded
VITE_USE_MOCKS=false VITE_API_BASE_URL=http://localhost:5055 npx vite --port 6174
node scripts/real-api-smoke.mjs                                  # full journey, report, share link, research pages
scripts/real-backend-docker.sh down                              # stop
```

## Scripts

| Script                          | What it does                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | `tsc --noEmit`                                                                                                   |
| `npm run lint` / `format:check` | ESLint / Prettier                                                                                                |
| `npm test`                      | Vitest + React Testing Library + axe-core                                                                        |
| `npm run test:e2e`              | Playwright: full journey, refresh-resume, a11y (axe, WCAG 2.1 AA), 360/768/1440 screenshots → `e2e/screenshots/` |
| `npm run build`                 | production build (mock code is excluded unless `VITE_USE_MOCKS=true`)                                            |

First e2e run: `npx playwright install chromium`. The e2e suite also checks accessibility and overflow on the research and sign-in pages, and measures page load (LCP) on throttled 4G (median of 3 cold loads, under 2.5s).

Visual QA against a running dev server: `node scripts/shoot.mjs http://localhost:5173 qa-shots /,/start --full` saves screenshots at 360, 768 and 1440px.

## Routes

| Route                | Screen                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| `/`                  | Future Portal                                                                  |
| `/start`             | Occupation selection (search, "door" cards)                                    |
| `/simulate`          | Scenario simulator (3 server-driven chapters)                                  |
| `/report`            | My Futureprint (printable, with a share link)                                  |
| `/r/:token`          | Read-only shared report (`GET /reports/{share_token}`)                         |
| `/observatory`       | Workforce Observatory (sample data until research arrives)                     |
| `/occupations/:slug` | Task Scanner                                                                   |
| `/methodology`       | Methodology framework                                                          |
| `/signin`            | Sign in / create account, a **design preview only** (sends and stores nothing) |

## Structure

```
src/
  app/          providers, route table (lazy per feature), layout, lazy motion features
  components/   ui/ (Button, PageHeader, Badge, Tabs, SearchInput), BrandHeader, SiteFooter,
                DecisionCard, OccupationCard, ProgressSteps, PathwayCard, PathwayIcon,
                ReportSection, SourceLink, Loading/Error/EmptyState, MockModeBadge
  features/     portal, occupations, simulator, report, observatory, task-scanner,
                methodology, auth (preview)
  hooks/        TanStack Query hooks for the session
  lib/          api client, session token store, config, pathway + evidence labels
  mocks/        in-browser mock server following the provisional contract
  types/api.ts  shared API types (provisional, see ../docs/api-contract-provisional.md)
```

Design decisions: [../docs/DESIGN_AUDIT.md](../docs/DESIGN_AUDIT.md). Milestones, commits and test results: [../docs/FRONTEND_PROGRESS.md](../docs/FRONTEND_PROGRESS.md).

## Rules the UI follows

- The server is authoritative. The UI never computes scenario transitions, scores or advice; it renders what the API returns.
- The session token lives in `sessionStorage`, is sent only as a Bearer header, and is never logged or put in a URL.
- Stale-step (409) errors trigger a re-fetch of the current session. Expired sessions clear the token and show a restart state.
