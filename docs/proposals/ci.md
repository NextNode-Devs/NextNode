# CI/CD

Status: **active** since the initial commit (27 Oct 2026). The workflow files
under `.github/workflows/` are the source of truth; this page explains them.
The original proposal, run locally before activation, lives in git history.

## Workflows

| File | Runs on | What it does |
| --- | --- | --- |
| `ci.yml` | push to `develop`, `feature/**`; PRs into `develop`; manual; called by `staging.yml` | Jobs `compose`, `frontend`, `backend`, `e2e` (below) |
| `branch-flow.yml` | every PR | Enforces `feature/*` → `develop` → `staging` → `main`: only `develop` may merge into `staging`, only `staging` into `main` |
| `staging.yml` | PRs into `staging`; push to `staging`; manual | Runs `ci.yml` in full, then the **`Staging gate`** check (fails unless every CI job passed); the deploy job is off (see CD below) |

Roles: `develop` is integration (CI as early feedback); **`staging` is where
testing is completed**, including any seeded data once it exists; **`main` is
production** and runs no tests of its own. There is no `production.yml`.

`ci.yml` jobs:

| Job | Steps |
| --- | --- |
| `compose` | `docker compose config --quiet` |
| `frontend` | `npm ci` (cached), `npm audit --audit-level=high`, `lint`, `typecheck`, `test`, `build` |
| `backend` | PostgreSQL 17 service; `uv sync --locked` (cached); `ruff format --check`, `ruff check`, `lint-imports`, `check_max_lines`, `manage.py check`, `makemigrations --check`, `migrate`, `pytest`, `pip-audit`; production `check --deploy` with placeholder values |
| `e2e` | after `frontend` and `backend`: PostgreSQL 17, migrations, Playwright Chromium (cached, retried download), `npm run test:e2e` against the real build, API and database; report uploaded on failure |

Every job has a `timeout-minutes`. Each step is a separate named command, so a
failure names the check that failed.

## Secrets and credentials

CI uses no real credentials. `DATABASE_URL` points at the throwaway service
container and `DJANGO_SECRET_KEY` is generated per run; both are placeholders.
No Clerk or Stripe key is needed for any current job.

- **Clerk (from #1):** authenticated E2E tests will need a Clerk development
  instance's keys as GitHub **environment** secrets.
- **Stripe (#7):** webhook tests use payloads signed with a generated test
  secret, so they need no Stripe secret. The end-to-end deposit run creates a
  Checkout Session, which needs a Stripe **test** secret key
  (`STRIPE_SECRET_KEY`) as a GitHub environment secret, unless a CI-only fake
  `PaymentGateway` is used for that job. Stripe setup, credentials and this
  choice belong to the Team Lead (`shar-hylton`) in #7. Never live keys;
  never a key in YAML, docs or issues.

## Additions planned with #1

The WebSocket foundation needs Redis. When #1 lands, add this service to the
`backend` and `e2e` jobs next to `db`, and `REDIS_URL:
redis://localhost:6379/0` to their environment. Pin the image to an exact
version when it is added.

```yaml
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-timeout 3s --health-retries 10
```

## CD

No deployment target exists. Hosting (AWS per the proposal) is deferred and
Phase 1 is submitted as a runnable zip (backlog NN-28). In `staging.yml` the
`Staging gate` job writes a "nothing deployed" summary; the `deploy` job runs
only on pushes to `staging` and is skipped unless
the repository variable `STAGING_DEPLOY_ENABLED` is `true`, and even then it
fails until real deploy steps are added. To activate it: create the `staging`
environment with required reviewers and its secrets, replace the `Deploy`
step with the chosen provider's commands, then set the variable. There is no
production workflow: `main` is production, all testing is completed on
`staging`, and production deploys are out of scope for Phase 1.

## Branches and protection

Feature PRs target `develop`; `develop` → `staging` (testing) → `main`
(production) by PR only.
Recommended protection (admin action), with one approving review, no force
pushes and no deletion on all three, and these required status checks:

| Branch | Required checks |
| --- | --- |
| `develop` | `Docker Compose config`, `frontend`, `backend`, `e2e`, `check` (Branch flow) |
| `staging` | `Staging gate`, `check` (Branch flow) |
| `main` | `Staging gate`, `check` (Branch flow) |

`Staging gate` already depends on every CI job, so it is the only CI check
`staging` needs. On `main` it is satisfied by the run already recorded on the
promoted `staging` commit (from the push to `staging`), so nothing is
re-tested. Merge `staging` → `main` with a merge commit, not squash or
rebase, so the PR head stays the tested `staging` commit. A check appears in the branch-protection picker only after it
has run at least once on the repository.

## Background: what was adapted from PUBLIC

| Adapted | Why |
| --- | --- |
| Branch-flow guard | Same promotion model was requested for NextNode |
| Explicit `timeout-minutes` on every job | PUBLIC lost hours to a hung job with the 6-hour default |
| "Boots in production mode" smoke step | PUBLIC shipped a green build that could not start in production |
| Playwright browser cache with a retried, time-limited download | PUBLIC's browser download once stalled for 3 hours |

Not copied: npm workspace commands, Supabase migration checks, Render
deploys, PUBLIC's staging/production workflows, scheduled product jobs, and
the memory-ceiling sampler.
