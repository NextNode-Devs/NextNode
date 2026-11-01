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

# 1. Database and Redis
docker compose up -d db redis        # PostgreSQL on :5432, Redis on :6379 (POSTGRES_PORT / REDIS_PORT to change)

# 2. Backend
cd backend
cp .env.example .env                 # then set DJANGO_SECRET_KEY to any long random string
uv sync                              # creates .venv and installs locked dependencies
uv run python manage.py migrate
cd ..

# 3. Frontend
cd frontend
cp .env.example .env.local           # add the Clerk development keys (docs/external-accounts.md)
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
| | `REDIS_URL` | Channels layer for the authenticated socket. Default `redis://localhost:6379/0`; required in production |
| | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe **test mode** (`sk_test_…`, `whsec_…`); both or neither. Empty = payments off (webhook answers 503). Live keys are refused outside production |
| | `DEPOSIT_PERCENT` | Deposit as a % of the accepted offer total; default `20` |
| | `PRIVATE_MEDIA_ROOT` | Folder for private requirement documents (#3); default `backend/private_media`, git-ignored and served by nothing |
| | `UPLOAD_MAX_BYTES`, `UPLOAD_MAX_FILES_PER_PROJECT` | Document limits; default 10 MB and 10 files (confirmed) |
| `frontend/.env.local` | `API_BASE_URL` | Where the Next.js server reaches Django (server-only) |
| | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk development publishable key (`pk_test_…`, public by design). Empty = sign-in off |
| | `CLERK_SECRET_KEY` | Clerk secret key (`sk_test_…`). **Server-only**; required whenever the publishable key is set |
| | `NEXT_PUBLIC_API_BASE_URL` | Django as reached from the browser; default `http://localhost:8000` |
| | `NEXT_PUBLIC_WS_URL` | The authenticated socket; default `ws://localhost:8000/ws` |

Both apps validate configuration at startup and stop with a message naming the
missing or invalid variable.

### Stripe webhooks locally (test mode)

Only needed when working on payments (#7). Install the
[Stripe CLI](https://docs.stripe.com/stripe-cli), then:

```bash
stripe login                     # test mode
stripe listen --forward-to localhost:8000/api/payments/stripe/webhook/
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET in backend/.env, restart the backend
```

Payment status changes only when a signed webhook arrives; returning from
Checkout changes nothing. CI never uses Stripe keys: tests sign payloads with
a generated secret. No real money moves, and NextNode holds no funds.

### Migrations

```bash
cd backend
uv run python manage.py makemigrations     # after changing models in nextnode/infrastructure/persistence
uv run python manage.py migrate
uv run python manage.py makemigrations --check --dry-run   # CI-style "nothing forgotten" check
```

## Running

Two terminals (with `docker compose up -d db redis` already running):

```bash
cd backend  && uv run uvicorn config.asgi:application --reload --port 8000   # http://localhost:8000/api/health/
cd frontend && npm run dev                              # http://localhost:3000
```

Sign up at `/sign-up` (email or Google), choose **Developer** or **Client**
once at `/onboarding`, and land on the role-aware `/dashboard`. The home page
also shows a live **Backend connection** card (API, database, Clerk
verification). Without Clerk keys, protected pages redirect to `/sign-in`,
which says sign-in isn't set up.

To run the frontend on another port (e.g. `npx next dev --port 3001` while 3000
is taken), add that origin to `FRONTEND_ORIGIN` in `backend/.env`
(comma-separated, e.g. `http://localhost:3000,http://localhost:3001`) and
restart the backend. Otherwise Django refuses the browser's requests and Clerk
tokens, and signed-in pages bounce between `/onboarding` and `/sign-in`. Only
one `next dev` can run per checkout.

**Windows:** stopping `uvicorn --reload` (closing the terminal, or killing it
from Task Manager) can leave its worker process running and still holding port
8000 with the old settings. If changes to `backend/.env` seem to have no effect,
or sign-in loops, run `Get-NetTCPConnection -LocalPort 8000 -State Listen` in
PowerShell, stop any leftover `python.exe` processes, and start the backend
again. Stopping it with Ctrl+C in its own terminal avoids this.

To see a socket event cross backend processes through Redis, run a second
backend with `--port 8001`, point a browser at it (`NEXT_PUBLIC_WS_URL`), and from the
first process run `uv run python manage.py send_realtime_test_event <account_id>`.

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
settings check and `docker compose config`) on pushes to `develop` and
`feature/**` and on PRs into `develop`, as early feedback. **`staging` is
where testing is completed:** `staging.yml` runs the full suite and reports
one `Staging gate` check. `main` is production and is not re-tested; it only
accepts `staging` commits that passed `Staging gate`. Details:
`docs/proposals/ci.md`. CI needs no real credentials.

## Branches and contributing

`feature/<issue>-<short-name>` → pull request into `develop` → `staging`
(testing) → `main` (production). Never push directly to `develop`, `staging` or `main`; a workflow
rejects PRs that skip a step. Each PR must pass CI and get a review.

## Current status (setup stage)

Built and verified locally: both app skeletons, configuration validation,
`GET /api/health/`, Clerk token verification on protected endpoints
(`GET /api/me/`, tested with locally signed tokens), JSON error envelope, CORS,
the frontend health card with loading/ready/error states, and all checks above.

Built by #1: Clerk sign-in/sign-up, accounts with a role chosen once,
onboarding, `GET /api/me/`, `GET /api/skills/`, the dashboard shell, the shared
deny-by-default access policy and the authenticated WebSocket on Redis.

Built by #2: developer portfolios (edit at `/developers/me/edit`, view at
`/developers/[id]`) and the developer directory at `/developers` (search, skill
and availability filters, all in the URL); clients have no portfolio and never
appear in it. Links are shown as entered; nothing is labelled "verified".

Built by #3: client project briefs (proposed budget, minimum CAD 1,500
enforced by the backend) and developer project ideas (the creator is the Team
Lead; no budget or payments), each with one team; project search at
`/projects` (kind, tech stack, "needs a Lead", "has open spots", all in the
URL), detail at `/projects/[id]` with the one applicable action ("Apply to
lead" from #4), editing by the owner while allowed, and "My projects" on the
dashboard. Clients upload private PDF/DOCX requirement documents (checked by
extension and file signature; 10 MB, 10 per project) that only the client, the
Team Lead and approved members can list or download, through links that expire
after 15 minutes and re-check access. Hire Lead (#4) now runs on real projects.

Built by #4: hiring conversations over the authenticated socket (live
messages, history, catch-up after a dropped connection, unread counts, read-only
once closed with the reason) and Hire Lead. A developer applies on a client
project's page; a client invites a developer from their portfolio ("Invite to
lead…", choosing one of their projects that still needs a Lead). Each opens a
conversation shown on the project's page: the client sees every candidate there
and picks whose chat to open; the developer sees their own. The client hires
inside the conversation; the other candidates' conversations close live with
the reason. The dashboard lists a client's applicants and a developer's
invitations and applications, each opening its chat; every conversation is also
under Conversations in the header.

Built by #5: Hire Devs and the team roster. The Team Lead sets the team size
(5–7 people, the Lead included) on the project page; developers apply to join
while spots are open (once per team), and the Lead accepts or rejects; the Lead
invites from a developer's portfolio ("Invite to my team…"), and only the
invited developer can accept. Each application or invitation opens a
conversation. A team never exceeds its size; when it fills, every other pending
application and invitation closes live with "The team is full". The project
page shows the team profile with portfolio links, members can read the
requirement documents, and a locked team refuses new members with "Recruitment
has closed". Works the same on a developer's own project, where the creator is
the Lead.

Not built yet:
offers and the project start (#6), workspaces and the deposit wiring (see `docs/backlog.md`). CI is active; there is no deployment target yet
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
- Hiring conversations need Redis for live delivery (Docker Compose starts
  it). Design: `docs/proposals/realtime-messaging.md`.
- Phase 1 ends at project initiation (direction approved) and is due
  **1 November 2026**: `docs/phase-1-scope-review.md`.
- Clerk and Stripe accounts do not exist yet; `.env.example` files hold
  placeholders only. Setup steps: `docs/external-accounts.md`.
