# NextNode — repository guide

Collaborative freelance marketplace: developers form squads, build projects for
clients or their own portfolios, and ship work into verified portfolios.
CPAN 314, Group 1. Currently in **Phase 2: Prototype Refinement** (due
23 Nov 2026, target 22 Nov): UI-first prototype screens on top of the working
Phase 1 build. Backlog: `docs/backlog-phase-2.md`. Rules:
`docs/decisions/phase-2-product-decisions.md`.

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

- Build only what the approved scope needs (`docs/backlog.md`, and for
  Phase 2 `docs/backlog-phase-2.md`); ask before adding a role, workflow,
  integration or package the spec does not name. Scope grows per iteration
  (agile): stakeholder requests enter through a recorded decision.
- Keep Hire Lead (developer applies to *lead* a client project) and Hire Devs
  (developer joins a team) distinct. Teams are 5–7 people including the Lead.
- Payments are Stripe test mode with webhook-confirmed status. The running
  integration holds no funds and makes no payouts, and nothing may claim
  otherwise. Phase 2 prototype screens may show the planned milestone-held
  flow only when it is labelled "Planned".
- Phase 2 prototype screens never change a working Phase 1 flow; sample data
  stays in prototype screens and is labelled.
- No file over 500 lines. Imports follow each project's layer direction.
- Secrets live in environment variables, are listed (as placeholders) in
  `.env.example`, and are never committed, logged or sent to the browser.
- Branch flow: `feature/*` → `develop` → `staging` → `main`, through reviewed
  pull requests. No direct pushes to protected branches.
