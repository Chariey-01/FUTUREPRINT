# Contributing to FUTUREPRINT

How the team works in this repository. The [README](README.md) covers setting up and running the project.

## Branches and pull requests

- `main` is always deployable. Don't push to it directly. Every change lands through a pull request.
- Branch from an up-to-date `main` and name the branch after the work: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `content/<topic>` (seed and research data), `chore/<topic>`.
- Keep a PR to one logical change. A PR that reaches into another person's area (frontend, backend, engine, research data) needs a review from that area's owner.
- If `main` moves while your PR is open, merge `main` into your branch and resolve conflicts there, not on `main`.

## Commit messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) style the history already follows:

```
<type>(<optional scope>): <imperative summary, at most ~72 characters>

Why the change is needed and anything a reviewer can't see from the diff.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Common scopes: `client`, `server`, `engine`, `report`, `occupations`, `seed`.

## Before you open a PR

CI runs these on every PR (see `.github/workflows/`). Run them locally first.

**Client** (`cd client`):

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

**Server** (`cd server`, with `TEST_DATABASE_URL` set as in [server/README.md](server/README.md#running-tests)):

```bash
flask seed validate
pytest
```

**Seed validator** (from the repository root): `python -m pytest test_validate_seed.py`

## Ground rules

- **Never commit secrets.** `.env` files are git-ignored. Only `*.env.example` (with placeholder values) belongs in the repository.
- **API changes are contract changes.** If you change a request or response shape, update the server README's API reference, `client/src/types/api.ts` and the mocks in the same PR. Open differences are tracked in [docs/api-contract-gaps.md](docs/api-contract-gaps.md).
- **Database changes need a migration** (`flask db migrate -m "..."`, then review the generated file). Never edit a migration that is already on `main`.
- **Research content follows the curation rules** in [server/seed_data/README.md](server/seed_data/README.md): use primary sources, label editorial notes, exclude anything unverified. `flask seed validate` checks the structure and the evidence references.
- Add or update tests for behaviour you change.
