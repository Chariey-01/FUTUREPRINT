# FUTUREPRINT

FUTUREPRINT is an interactive, evidence-backed platform that helps students, graduates and early-career professionals understand how work is changing and explore their own plausible futures. It is not a site that predicts which jobs AI will eliminate.

Visitors pick an occupation, see how its tasks are exposed to AI according to cited research, and play through a short scenario simulation. Each choice leans toward an **Adapt**, **Transform** or **Discover** pathway. At the end they get a printable, shareable report grounded in the same evidence. No account is needed: sessions are anonymous.

## Features

- **Occupation explorer:** six curated occupations with tasks, skills and AI-exposure levels from ILO research, labelled by region (Kenya, Africa, global).
- **Scenario simulator:** server-driven, three-chapter journeys. The scenario engine applies the rules, and every choice is validated and saved server-side.
- **Personal report:** a summary of the journey, pathway insights and evidence. Reports are immutable once generated and can be shared via an unguessable link.
- **Workforce Observatory and Task Scanner:** verified workforce events and task-by-task exposure breakdowns.
- **Methodology:** the sources, the exposure scale, a glossary and known gaps, so the evidence stays transparent.
- **Optional AI explanations:** evidence-grounded answers to visitor questions. Off by default, quota-limited, and never used to decide simulation outcomes.

## Tech stack

| Part | Stack |
|---|---|
| Client (`client/`) | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Framer Motion. Tested with Vitest, Testing Library, Playwright and axe-core |
| Server (`server/`) | Python 3.12, Flask 3, SQLAlchemy, Alembic (Flask-Migrate), Pydantic 2, PostgreSQL 16, gunicorn. Tested with pytest |
| Seed tooling (root) | `validate_seed.py` / `seed_schema.py`: validator for the software-developer scenario seed, with mutation tests |

## Repository layout

```
client/            visitor frontend (see client/README.md)
server/            REST API, database, scenario engine, seed data (see server/README.md)
docs/              design audit, frontend progress, API contract notes, auth proposal
.github/           CI workflows, PR template, Dependabot
validate_seed.py   seed validator for software-developer.json (+ test_validate_seed.py)
```

## Quick start

Requires Node 20+ and, for the API, Python 3.12 and PostgreSQL 16. `.nvmrc` and `.python-version` pin the versions.

**Frontend only (no backend needed):** runs the full journey on in-browser sample data.

```bash
cd client
npm install
npm run dev:mock          # http://localhost:5173
```

**Full stack:**

```bash
# 1. API: see server/README.md for creating the database and filling in .env
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements-dev.txt
cd server
cp .env.example .env      # set DATABASE_URL and SECRET_KEY
flask db upgrade && flask seed load
flask run --port 5000

# 2. Client, in a second terminal. Vite proxies /api to localhost:5000.
cd client
npm install
npm run dev               # http://localhost:5173
```

> **Note:** the client was built against a provisional API contract that doesn't yet match the server. Until the two are reconciled, use mock mode for the full journey. See [docs/api-contract-gaps.md](docs/api-contract-gaps.md).

## Testing

| What | Command |
|---|---|
| Client checks | `cd client && npm run format:check && npm run lint && npm run typecheck && npm test` |
| Client end to end | `cd client && npx playwright install chromium && npm run test:e2e` |
| Server suite (needs PostgreSQL) | `cd server && TEST_DATABASE_URL=postgresql://…/futureprint_test pytest` |
| Seed data | `cd server && flask seed validate`, and `python -m pytest test_validate_seed.py` from the root |

GitHub Actions runs the client checks and builds, and the server suite against PostgreSQL 16, on every pull request (`.github/workflows/`).

## Documentation

- [client/README.md](client/README.md): frontend scripts, routes and structure
- [server/README.md](server/README.md): API setup, configuration, the full API reference, production notes
- [server/docs/engine-integration.md](server/docs/engine-integration.md): the scenario-engine contract
- [server/seed_data/README.md](server/seed_data/README.md): research sources and curation rules
- [docs/api-contract-gaps.md](docs/api-contract-gaps.md): open differences between client and server
- [docs/AUTH_PROPOSAL.md](docs/AUTH_PROPOSAL.md): proposal for mandatory login (awaiting a decision)
- [docs/DESIGN_AUDIT.md](docs/DESIGN_AUDIT.md) and [docs/FRONTEND_PROGRESS.md](docs/FRONTEND_PROGRESS.md): design decisions and the frontend log

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit style and the checks to run before opening a pull request.
