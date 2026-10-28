---
name: architecture
description: Read before creating, moving, or reviewing files in the NextNode repo. Routes to the frontend (FSD + Atomic Design, Next.js) or backend (Clean Architecture, Django + DRF) ruleset and covers the rules shared by both projects.
---

# Architecture

NextNode is two independent projects in one repository. Decide which one a
change belongs to **before** creating any file.

| Path        | Project                    | Architecture                          | Detailed rules                |
| ----------- | -------------------------- | ------------------------------------- | ----------------------------- |
| `frontend/` | Next.js + TypeScript client | Feature-Sliced Design + Atomic Design | `frontend-architecture` skill |
| `backend/`  | Django + DRF REST API       | Clean Architecture                    | `backend-architecture` skill  |
| repo root   | Shared tooling only        | —                                     | `.github/`, docs, editor config |

The stack is fixed by the project proposal (*Technology & Tools*): Next.js
(React) + TypeScript, Django + DRF, PostgreSQL on AWS, Docker, GitHub Actions,
Stripe Checkout (test mode), WebSockets for chat. Do not introduce a second
backend framework, an ORM other than Django's, or a styling system other than
Tailwind CSS + shadcn/ui.

Read the matching skill in full before writing code. What the product must do
lives in the `nextnode-spec` skill. Only the shared rules are below.

## Shared rules

1. **Look before you create.** List the target directory first. A slice, use
   case, or component with a similar name usually already exists; extend it
   instead of adding a parallel one.
2. **Layers are one-way.** Both projects are layered, and imports may only
   point in the allowed direction. Frontend: ESLint `no-restricted-imports`
   (`frontend/eslint.config.mjs`). Backend: import-linter contracts
   (`backend/pyproject.toml`). Never silence a violation; the import is the
   thing that is wrong.
3. **Public APIs only.** A frontend slice's `index.ts` is its boundary;
   import from it, not from a file inside it.
4. **Business logic has a home, and it is not the edge.** Not in a React
   component, not in a DRF view or serializer, not in a route file. Frontend:
   `model/` or `lib/` in the owning slice. Backend: a use case or a domain
   entity.
5. **No file over 500 lines**, in either project (ESLint `max-lines`;
   `backend/scripts/check_max_lines.py`). When a file approaches the limit,
   split it along the seams the architecture already defines. Raising or
   disabling the limit is not an option.
6. **No speculative abstraction.** Add a layer, port, or wrapper when a second
   caller or a real swap requires it, not in anticipation of one. This is a
   Phase 1 prototype; build what the approved scope needs.
7. **Match the surrounding code.** Naming, file layout and comment density are
   established per layer; follow what the neighbouring files do.
8. **Secrets never leave the server.** Environment variables are read in one
   module per project (see each skill), listed in `.env.example`, and never
   committed. Only variables prefixed `NEXT_PUBLIC_` reach the browser, and
   none of those may be a secret.

## Verifying a change

These are configured and must pass before a change is considered done
(Postgres running: `docker compose up -d db` from the repo root):

```bash
# frontend/
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e
# backend/
uv run ruff format --check . && uv run ruff check . && uv run lint-imports
uv run python scripts/check_max_lines.py && uv run pytest
```

CI is proposed in `docs/proposals/ci.md` but not active until the workflows
are committed. Report a check you did not run as not run.
