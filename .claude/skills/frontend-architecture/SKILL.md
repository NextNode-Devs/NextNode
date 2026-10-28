---
name: frontend-architecture
description: Read before writing, moving, or reviewing any file under frontend/. Covers Feature-Sliced Design layers for Next.js App Router, Atomic Design for the shadcn-based UI kit, where each kind of code goes, server/client boundaries, hydration safety, and the 500-line decomposition workflow.
---

# Frontend architecture — `frontend/`

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.

Feature-Sliced Design (FSD) decides **which slice** code belongs to.
Atomic Design decides **how small** a component should be.
The 500-line ceiling is what forces the second question to be asked.

## 1. Layers

Top to bottom. Imports may only point **downward**: a layer may import from
any layer below it, never from one above or from a sibling slice.

| Layer      | Path            | Holds                                                  |
| ---------- | --------------- | ------------------------------------------------------ |
| `app`      | `src/app`       | Next.js routing, root layout, providers (Clerk), global styles |
| `views`    | `src/views`     | One slice per screen; lays out widgets                 |
| `widgets`  | `src/widgets`   | Self-contained blocks of a screen (organisms)          |
| `features` | `src/features`  | One user action per slice (`apply-to-lead`, `make-deposit`) |
| `entities` | `src/entities`  | Business nouns (`project`, `team`, `developer`, `payment`) and how they render |
| `shared`   | `src/shared`    | Domain-agnostic code: UI kit, API client, config, lib  |

Next.js-specific naming:

- The FSD `pages` layer is called **`views`**, because `pages` collides with
  the Next.js router.
- `src/app` is both the App Router and the FSD app layer. Non-route concerns
  live in underscore-prefixed private folders (`_providers`, `_styles`) which
  Next.js excludes from routing.

Do not create a layer or slice that has nothing in it yet.

### Slice anatomy

```
<layer>/<slice>/
├── ui/         # components
├── model/      # state, hooks, selectors, handlers, local validation
├── api/        # requests for this slice, via @/shared/api
├── lib/        # helpers used only by this slice
└── index.ts    # public API — the ONLY entry point for other slices
```

Other code imports `@/widgets/workspace-chat`, never
`@/widgets/workspace-chat/ui/message-list`. Slices on the same layer must not
import each other; when two need the same thing, push it down a layer.

Enforcement: `eslint.config.mjs` uses `no-restricted-imports` per layer
(upward and deep imports are errors) and `max-lines: 500`.

## 2. Atomic Design inside the UI kit

`shared/ui` is the design system. Everything there is presentational: props
in, markup out, no data fetching, no knowledge of any NextNode entity.

| Level     | Location              | Rule of thumb                                  | Example              |
| --------- | --------------------- | ---------------------------------------------- | -------------------- |
| Primitive | `shared/ui/shadcn`    | Vendored by the shadcn CLI; edit sparingly     | `button`, `dialog`   |
| Atom      | `shared/ui/atoms`     | One element, project props (`label`, `error`)  | `TextField`          |
| Molecule  | `shared/ui/molecules` | 2–5 atoms doing one small job                  | `SectionHeading`     |
| Organism  | `shared/ui/organisms` | Generic composed block, still domain-free      | `DataTable`          |
| Organism  | `widgets/<slice>/ui`  | Composed block that knows the domain           | `TeamRosterCard`     |
| Template  | `views/<slice>/ui`    | The page layout that arranges widgets          | `ProjectDetailView`  |

The split is "does it know what a project or team is?", not "how big is it?".
Atomic levels live **only** inside `shared/ui`; do not add a parallel
`components/` tree that competes with FSD.

Record local edits to vendored shadcn files in `shared/ui/shadcn/README.md`,
because `shadcn add --overwrite` discards them.

## 3. The 500-line rule

No file under `frontend/src` may exceed 500 lines (blank lines and comments
count). At ~300 lines, look for the seam. Decompose in this order, stopping at
the first that fits:

1. Extract leaf markup into a `shared/ui` atom or molecule (if domain-free).
2. Extract a domain-aware block into a widget or the owning entity/feature.
3. Extract logic into `model/use-<thing>.ts` in the same slice.
4. Extract constants (copy, options, column defs) into `config/` or
   `<name>.constants.ts`.
5. Split the slice; it is doing two jobs.

Not acceptable: longer lines, moving code into a file already near the limit,
or a `utils.ts` grab bag.

## 4. Where new code goes

| You are adding…                        | Put it in                                     |
| -------------------------------------- | --------------------------------------------- |
| A new route                            | `src/app/<segment>/page.tsx`, renders one view |
| The screen behind that route           | `src/views/<screen>/`                          |
| A reusable block of that screen        | `src/widgets/<block>/`                         |
| A user action (apply, invite, pay)     | `src/features/<action>/`                       |
| A business object + its rendering      | `src/entities/<noun>/`                         |
| A generic button/input/card            | `src/shared/ui/atoms` or `molecules`           |
| A call to the Django API               | The slice's `api/` segment, via `@/shared/api` |
| A server-only env var                  | `src/shared/config/env.server.ts` (+ `.env.example`) |
| A browser-visible env var              | `src/shared/config/env.public.ts`, `NEXT_PUBLIC_*` only |
| A shadcn primitive                     | `npx shadcn@latest add <name>` → `src/shared/ui/shadcn` |

ESLint forbids `process.env` outside `src/shared/config` (and Next's own
flags in `src/instrumentation.ts`). Server config is read lazily and validated
at server start by `instrumentation.ts`, so `next build` needs no runtime
secrets.

## 5. Route files stay thin

```tsx
// src/app/projects/[projectId]/page.tsx
import { ProjectDetailView } from "@/views/project-detail";

export const metadata = { title: "Project" };

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDetailView projectId={projectId} />;
}
```

Route files may read params, fetch data for the view and set metadata. No
layout blocks, no business logic. Check the installed Next.js version's docs
(`node_modules/next/dist/docs/`) before relying on an API from memory.

## 6. Server and client components

Components are Server Components by default. Add `"use client"` at the leaf
that actually needs state, effects or browser APIs, never on a view or layout
just to make a child work. Secrets, the Clerk secret key and the Stripe secret
key are server-only; import `server-only` in any module that touches them.

`cacheComponents` is on (Next.js 16). Uncached, per-request data must sit
inside a `<Suspense>` boundary with a real loading fallback, and server code
that reads request data or runtime config calls `await connection()` first —
`@/shared/api/server-client` already does. `widgets/backend-status` is the
reference: async server component + Suspense + presentational card with
loading / ready / error states.

## 7. Hydration safety

A hydration mismatch is a defect, never a warning to suppress.

- No `Date.now()`, `new Date()`, `Math.random()` or `crypto.randomUUID()` in
  render output. Generate on the server and pass down, or use `useId`.
- No `window`, `localStorage` or `navigator` during render; read them in an
  effect.
- Never format dates or numbers with `toLocale*` in a rendered component; Node
  and the browser disagree. Use one helper in `shared/lib/format-date.ts` with
  an explicit locale and time zone.
- Never use `suppressHydrationWarning` to hide a real mismatch.

## 8. Data flow and auth

`@/shared/api` owns `fetch`, the base URL, attaching the Clerk session token as
`Authorization: Bearer <token>`, and the error shape. Slice `api/` segments
call it; components never call `fetch` directly. The backend returns
`{ "data": … }` on success and `{ "error": { "code", "message", "fields"? } }`
on failure (see `backend-architecture`).

Next.js 16 renamed Middleware to **Proxy**: route protection lives in
`src/proxy.ts` (Clerk), and it is a fast redirect, not the authorization
decision. The backend re-checks every request.

## 9. UI/UX

Visual and interaction rules live in the `ui-ux` skill (shadcn, states,
feedback, forms, mobile, accessibility, tokens). Read it before building any
screen. For design decisions use `ui-ux-pro-max`; for shadcn/Tailwind
mechanics use `ui-styling`; for token structure use `design-system`.

## 10. Checklist before finishing

- [ ] Every file under 500 lines.
- [ ] No import points upward or sideways across slices.
- [ ] New slices expose an `index.ts` and are imported through it.
- [ ] Nothing in `shared/` knows about a NextNode entity.
- [ ] Client-facing types carry no team-internal field, and team-facing types
      carry no other client's data.
- [ ] Route files only render a view.
- [ ] `"use client"` only on leaves that need it; no secret in a client module.
- [ ] No hydration warnings in the browser console.
- [ ] Every action shows pending, success, failure and empty states.
- [ ] Unit tests next to the code (`*.test.tsx`, Vitest); user journeys in
      `frontend/e2e/` (Playwright, real backend).

```bash
cd frontend
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e   # needs Postgres running; starts both servers itself
```
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass.
