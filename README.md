# NextNode

*Build as a squad. Ship real projects. Prove it in your portfolio.*

A collaborative freelance marketplace where developers form project-based
squads to build software for clients or for their own portfolios.
CPAN 314 · Group 1 · **Phase 1: Initial Prototype Development**.

## Stack

| Area | Technology (from the project proposal) |
| --- | --- |
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) |
| Frontend architecture | Feature-Sliced Design + Atomic Design |
| Backend | Django 6 · Django REST Framework · Clean Architecture |
| Database | PostgreSQL (Docker locally; AWS-hosted per the proposal) |
| Auth | Clerk (registration, Google sign-in, session tokens) |
| Payments | Stripe Checkout, **test mode only** (not yet integrated) |
| Tooling | npm · uv · ESLint · Vitest · Playwright · Ruff · import-linter · pytest · Docker |

## Repository layout

```
NextNode/
├── frontend/            Next.js app (FSD layers under src/: app, views, widgets, shared …)
├── backend/             Django project: config/ + nextnode/{domain,application,infrastructure,presentation}
├── docs/
│   ├── backlog.md       Prioritised Phase 1 backlog
│   ├── decisions/       Approved product and security decisions
│   ├── proposals/ci.md  How the GitHub Actions workflows work
│   └── spec/README.md   Source documents and the UML title correction
├── .github/workflows/    CI (ci.yml), branch-flow guard, staging gate (staging.yml)
├── docker-compose.yml   Local PostgreSQL
├── AGENTS.md / CLAUDE.md
└── .claude/skills/      Project rules for Claude Code
```

**How the two apps talk:** the browser loads pages from Next.js. Next.js server
components call the Django API at `API_BASE_URL` (`/api/...`), which answers
`{ "data": … }` or `{ "error": { "code", "message", "fields"? } }`.
Authenticated calls will carry the Clerk session token as
`Authorization: Bearer <token>`; Django verifies it against Clerk's JWKS. CORS
allows only `FRONTEND_ORIGIN`.

## Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 22.13+ (or 24+) | npm 10+ |
| Python | 3.13 | installed automatically by uv if missing |
| uv | 0.12+ | https://docs.astral.sh/uv/ |
| Docker Desktop | with Compose v2 | runs PostgreSQL 17 |
| Git | any recent | |

## First-time setup

```bash
git clone https://github.com/NextNode-Devs/NextNode.git   # checks out develop (default branch)
cd NextNode

# 1. Database
docker compose up -d db              # PostgreSQL on localhost:5432 (POSTGRES_PORT to change)

# 2. Backend
cd backend
cp .env.example .env                 # then set DJANGO_SECRET_KEY to any long random string
uv sync                              # creates .venv and installs locked dependencies
uv run python manage.py migrate
cd ..

# 3. Frontend
cd frontend
cp .env.example .env.local
npm ci
npx playwright install chromium      # only needed for end-to-end tests
cd ..
```

### Environment variables

Templates hold placeholders only; never commit `.env` or `.env.local`.

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `DJANGO_ENV` | `development`, `test` or `production` |
| | `DJANGO_DEBUG` | `true` locally; refused in production |
| | `DJANGO_SECRET_KEY` | Required. Production needs 50+ random characters |
| | `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames |
| | `FRONTEND_ORIGIN` | Browser origin(s) allowed by CORS/CSRF, e.g. `http://localhost:3000` |
| | `DATABASE_URL` | `postgres://nextnode:nextnode@localhost:5432/nextnode` locally |
| | `CLERK_ISSUER` | Clerk Frontend API URL. Empty = auth off (every token refused); required in production |
| | `CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES` | Optional overrides |
| `frontend/.env.local` | `API_BASE_URL` | Where the Next.js server reaches Django (server-only) |

Both apps validate configuration at startup and stop with a message naming the
missing or invalid variable.

### Migrations

```bash
cd backend
uv run python manage.py makemigrations     # after changing models in nextnode/infrastructure/persistence
uv run python manage.py migrate
uv run python manage.py makemigrations --check --dry-run   # CI-style "nothing forgotten" check
```

## Running

Two terminals (with `docker compose up -d db` already running):

```bash
cd backend  && uv run python manage.py runserver        # http://localhost:8000/api/health/
cd frontend && npm run dev                              # http://localhost:3000
```

The home page shows a live **Backend connection** card (API, database, Clerk
verification). It is the only screen so far.

## Testing and checks

```bash
# frontend/
npm run lint          # ESLint incl. FSD layer boundaries and 500-line limit
npm run typecheck
npm test              # Vitest unit/component tests
npm run build
npm run test:e2e      # Playwright: builds and starts both apps on :3100/:8100

# backend/
uv run ruff format --check .
uv run ruff check .
uv run lint-imports                     # Clean Architecture contracts
uv run python scripts/check_max_lines.py
uv run python manage.py check
uv run pytest
```

GitHub Actions runs the same checks (plus dependency audits, a production
settings check and `docker compose config`) on every push to `develop`,
`staging`, `main` and `feature/**`, and on every pull request; for `staging`,
`staging.yml` runs them and reports one `Staging gate` check. Details:
`docs/proposals/ci.md`. CI needs no real credentials.

## Branches and contributing

`feature/<issue>-<short-name>` → pull request into `develop` → `staging` →
`main`. Never push directly to `develop`, `staging` or `main`; a workflow
rejects PRs that skip a step. Each PR must pass CI and get a review.

## Current status (setup stage)

Built and verified locally: both app skeletons, configuration validation,
`GET /api/health/`, Clerk token verification on protected endpoints
(`GET /api/me/`, tested with locally signed tokens), JSON error envelope, CORS,
the frontend health card with loading/ready/error states, and all checks above.

Not built yet: Clerk sign-in UI, accounts and onboarding, portfolios,
projects, hiring, team formation, workspaces and payments (see
`docs/backlog.md`). CI is active; there is no deployment target yet
(`staging.yml` gates `staging` on CI; its deploy job is off and deploys nothing).

## Product rules every contributor must know

- **Hire Lead** (client-funded projects): a client publishes a project; a
  developer applies to lead it, or the client invites one from their
  portfolio; each opens a hiring conversation; the client hires one Team Lead
  and the other candidates' conversations close.
- **Hire Devs** (client-funded and developer-created projects): the Team Lead
  opens developer spots; developers apply to join, or the Team Lead invites
  them; an application joins when the Team Lead accepts it, an invitation joins
  only when the invited developer accepts it.
- **Team size is 5–7 people in total, including the Team Lead.**
- **Team Lead is a per-project responsibility held by a Developer**, not an
  account type. Account roles are Developer and Client.
- **Developer-created projects** make their creator the Team Lead and have no
  payments.
- **Payments:** Stripe test mode for demonstration only. Phase 1 tracks payment
  status from verified webhooks; it does **not** hold funds in escrow, transfer
  money or pay developers.

Details and remaining conflicts: `docs/decisions/phase-1-product-decisions.md`.

## Known limitations

- Source documents (proposal, UML diagrams, Phase 1 brief) are not yet in
  `docs/spec/` — see `docs/spec/README.md`.
- `manage.py check --deploy` warns that HSTS preload is off; that is a
  deliberate opt-in once a production domain exists.
- Real-time chat is not set up yet. Hiring conversations will use WebSockets
  (Django Channels with a Redis channel layer) from Phase 1 — design in
  `docs/proposals/realtime-messaging.md`. Redis is added to
  `docker-compose.yml` by #1.
- Phase 1 ends at project initiation (direction approved) and is due
  **1 November 2026**: `docs/phase-1-scope-review.md`.
- Clerk and Stripe accounts do not exist yet; `.env.example` files hold
  placeholders only. Setup steps: `docs/external-accounts.md`.
