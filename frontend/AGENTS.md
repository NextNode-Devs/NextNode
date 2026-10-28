# Frontend architecture

Feature-Sliced Design + Atomic Design. Full rules:
`../.claude/skills/frontend-architecture/SKILL.md`; UI rules: `../.claude/skills/ui-ux/SKILL.md`.

- Layers, top to bottom: `app` → `views` → `widgets` → `features` → `entities` → `shared`.
  Imports point downward only, through a slice's `index.ts` (ESLint enforces it).
- No file over 500 lines. `process.env` is read only in `src/shared/config`.
- `src/app/**` holds routing only; a `page.tsx` renders one view.
- shadcn primitives live in `src/shared/ui/shadcn` (`components.json` aliases point there).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
