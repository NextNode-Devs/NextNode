# Onboarding tasks — two members not yet onboarded

Prepared 27 Oct 2026. **Not assigned.** The two group members who have not
onboarded are not named in any project record available to the repository,
and neither has an active membership in the `NextNode-Devs` organization.
Assign these tasks only after the Team Lead confirms who they are, they accept
the organization invitation, and their GitHub usernames are verified.

The tasks avoid the critical path (#1 → #3 → #4 → #5 → #6, #2 alongside, #7
Stripe owned by the Team Lead). None of them blocks another issue, and all
feed graded Phase 1 deliverables due **1 November 2026**.

## Before either member starts (Team Lead)

1. Invite them to `NextNode-Devs` with **Write** access to `NextNode`
   (needed to push `feature/*` branches; `develop`, `staging` and `main` are
   PR-only).
2. Verify each GitHub username against the person, then create or assign the
   issues below.
3. They follow `README.md` → First-time setup and read `AGENTS.md`.

---

## Onboarding member 1

### O1 · Source documents into `docs/spec/` and the diagram title fix (backlog NN-23)

**Purpose:** every issue traces to the proposal and UML diagrams, but none of
the five PDFs is in the repository, so nobody can check a trace or a
requirement. This unblocks verification for the whole team.

**Acceptance criteria**
1. The five documents listed in `docs/spec/README.md` are committed under the
   expected file names, through a PR into `develop`.
2. `docs/spec/README.md` shows each as present.
3. The swapped activity-diagram titles ("Hire Devs" / "Hire Lead") are fixed
   in the editable diagram source if the group has it, and re-exported;
   otherwise the README records who holds the source.
4. Any statement in `docs/backlog.md`, `docs/phase-1-scope-review.md` or the
   `nextnode-spec` skill that the PDFs contradict is listed in a PR comment
   for the Team Lead. No requirement is changed without the Team Lead's
   decision.

**Files:** `docs/spec/`, `docs/spec/README.md`.
**Prerequisites:** the PDFs and diagram sources from the group. **Dependencies:** none.
**Suggested issue:** "Add source documents to docs/spec and fix the activity-diagram titles" (labels `documentation`, `phase-1`).

### O2 · ER diagram of the Phase 1 schema (backlog NN-27)

**Purpose:** the proposal lists an ER diagram as a deliverable.

**Acceptance criteria**
1. A diagram (editable source, e.g. Mermaid in Markdown or draw.io, plus a
   PNG/PDF export) under `docs/` shows every model the Phase 1 issues define:
   accounts and profiles (#1), portfolio (#2), project, team, membership and
   documents (#3), conversations, messages and lead applications/invitations
   (#4), team applications/invitations (#5), offers and acceptances (#6),
   payments (#7).
2. Entities, keys, multiplicities and status fields match the issue
   descriptions and, once merged, the actual migrations. Where the class
   diagram differs (e.g. one team per project), the diagram follows the
   approved decision and notes it.
3. Updated when models merge; the final version matches `makemigrations`
   output before submission.

**Files:** `docs/` (new `er-diagram.md` or similar), reading `backend/nextnode/infrastructure/persistence/`.
**Prerequisites:** none to start (draft from issues #1–#7). **Dependencies:** finalised as #1–#7 merge.
**Suggested issue:** "ER diagram of the Phase 1 schema" (labels `documentation`, `phase-1`).

---

## Onboarding member 2

### O3 · Fresh-clone setup verification

**Purpose:** the progress report must include setup instructions that work.
A new member is the best test of `README.md`.

**Acceptance criteria**
1. Starting from a clean clone on their own machine, they follow only
   `README.md` until both apps run, the home page's **Backend connection**
   card is green, and every listed check passes.
2. Every step that failed, was missing or was unclear is fixed in `README.md`
   (or the relevant `.env.example`) in one PR, with the OS and tool versions
   used.
3. No real credentials are added anywhere.

**Files:** `README.md`, `backend/.env.example`, `frontend/.env.example`.
**Prerequisites:** Node 22.13+, uv, Docker Desktop, Git. **Dependencies:** none.
**Suggested issue:** "Verify setup instructions from a fresh clone" (labels `documentation`, `phase-1`).

### O4 · Phase 1 submission pack (backlog NN-22) and responsive/accessibility pass (NN-21)

**Purpose:** the Phase 1 brief grades a prototype zip, a progress report with
setup instructions, and a task distribution sheet.

**Acceptance criteria**
1. `docs/submission/` holds drafts of the progress report and the task
   distribution sheet, written from merged PRs and issue history: who did
   what, what works, what is deferred. Nothing is claimed that is not merged
   and working.
2. A documented, repeatable way to build the prototype zip from `develop`
   that excludes `.env*` (except examples), `node_modules`, `.venv`, `.next`
   and other generated files.
3. As each screen merges, it is checked at 375 / 768 / 1280 px and by
   keyboard (visible focus, labelled fields); problems are filed as issues
   against the owning issue's assignee.
4. The final versions are ready for the Team Lead's review by 31 Oct 2026.

**Files:** `docs/submission/` (new), `README.md` (setup section, with O3).
**Prerequisites:** O3 completed or in progress. **Dependencies:** content grows as #1–#7 merge; does not block them.
**Suggested issue:** "Phase 1 submission pack and responsive/accessibility pass" (labels `documentation`, `phase-1`).
