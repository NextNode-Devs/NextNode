# NextNode — repository guide

Collaborative freelance marketplace: developers form squads, build projects for
clients or their own portfolios, and ship work into verified portfolios.
CPAN 314, Group 1. Currently in **Phase 1: Initial Prototype Development**.

| Path        | Project                         | Architecture                          | Tooling |
| ----------- | ------------------------------- | ------------------------------------- | ------- |
| `frontend/` | Next.js 16 + TypeScript client  | Feature-Sliced Design + Atomic Design | npm, ESLint, Vitest, Playwright |
| `backend/`  | Django 6 + DRF REST API         | Clean Architecture                    | uv, Ruff, import-linter, pytest |

Setup and commands: `README.md`. Product decisions: `nextnode-spec` skill.

## Which skill to read

Project skills live in `.claude/skills/`; update rules there, not here.

| Work | Read |
| --- | --- |
| Any product behaviour, roles, workflows, payments scope | `nextnode-spec` |
| Creating or moving files; which project a change belongs to | `architecture` |
| Anything under `frontend/` | `frontend-architecture` |
| Anything under `backend/`, incl. API design, validation, migrations | `backend-architecture` |
| Auth, CSRF/CORS, secrets, files, payments security | `backend-architecture` §5–8 and `docs/decisions/auth-cors-csrf.md` |
| Any screen, form, state, responsiveness, accessibility | `ui-ux` (then `ui-ux-pro-max`, `ui-styling`, `design-system` as needed) |
| Testing, and before calling anything done | `nextnode-definition-of-done` |

**Definition of done:** in this repository use `nextnode-definition-of-done`.
A personal (user-level) `definition-of-done` skill written for another project
may also be listed; it does not apply to NextNode and must be ignored here.

## Non-negotiables

- Build only what the approved Phase 1 scope needs (`docs/backlog.md`); ask
  before adding a role, workflow, integration or package the spec does not name.
- Keep Hire Lead (developer applies to *lead* a client project) and Hire Devs
  (developer joins a team) distinct. Teams are 5–7 people including the Lead.
- Payments are Stripe test mode with webhook-confirmed status; no escrow, no
  payouts, and nothing may claim otherwise.
- No file over 500 lines. Imports follow each project's layer direction.
- Secrets live in environment variables, are listed (as placeholders) in
  `.env.example`, and are never committed, logged or sent to the browser.
- Branch flow: `feature/*` → `develop` → `staging` → `main`, through reviewed
  pull requests. No direct pushes to protected branches.
