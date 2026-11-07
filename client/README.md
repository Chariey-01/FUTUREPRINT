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

## Scripts

| Script                          | What it does                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`             | `tsc --noEmit`                                                                                                   |
| `npm run lint` / `format:check` | ESLint / Prettier                                                                                                |
| `npm test`                      | Vitest + React Testing Library + axe-core                                                                        |
| `npm run test:e2e`              | Playwright: full journey, refresh-resume, a11y (axe, WCAG 2.1 AA), 360/768/1440 screenshots → `e2e/screenshots/` |
| `npm run build`                 | production build (mock code is excluded unless `VITE_USE_MOCKS=true`)                                            |

First e2e run: `npx playwright install chromium`.

## Structure

```
src/
  app/          providers, routes (lazy per feature), layout
  components/   BrandHeader, DecisionCard, OccupationCard, ProgressSteps, PathwayCard,
                ReportSection, SourceLink, Loading/Error/EmptyState, MockModeBadge
  features/     portal (/), occupations (/start), simulator (/simulate), report (/report)
  hooks/        TanStack Query hooks for the session
  lib/          api client, session token store, config, pathway presentation
  mocks/        in-browser mock server that follows the provisional contract
  types/api.ts  shared API types (provisional, see ../docs/api-contract-provisional.md)
```

## Rules the UI follows

- The server is authoritative. The UI never computes scenario transitions, scores or advice; it renders what the API returns.
- The session token lives in `sessionStorage`, is sent only as a Bearer header, and is never logged or put in a URL.
- Stale-step (409) errors trigger a re-fetch of the current session. Expired sessions clear the token and show a restart state.
