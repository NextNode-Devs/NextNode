---
name: nextnode-definition-of-done
description: The completion standard for NextNode. Read BEFORE starting any issue, feature or bug fix, and again BEFORE reporting anything as done, complete, implemented, ready or closed. A task is done only when the intended developer, team lead or client can open the running app, reach the feature, use it with real input and see the correct, persisted result — not when the API, migration, tests, lint or typecheck pass. Triggers on: "is this done", "mark as done", "close the issue", "what's left", "move to the next issue", "ready for review".
---

# NextNode — Definition of Done

## 1. The standard

**DONE means the functionality is built, integrated, and usable by the
intended user through the running NextNode UI.**

It is **not** done because the endpoint works, the migration ran, seed data
shows up, tests pass, or `curl` returns 200. Those are steps, not completion.

> Can the intended developer, team lead or client open the app, navigate to the
> feature, provide real input, perform the action, and see the correct result?

If no, it is not done.

## 2. The whole path is the feature

```text
Requirement → domain/use case → API → frontend → UI → real user action → visible, persisted result
```

Example: "A client hires a Team Lead" is done when a client can sign in → open
their posted project → see applicants with portfolios → open a chat with one →
accept them → see that developer shown as Team Lead → see the other applicants'
chats closed → leave, come back, and see the same state. And the hired
developer, signed in separately, sees themselves as Team Lead of that project.

## 3. Seed and mock data never fake completion

Seed data supports development. It must never stand in for a workflow a user is
meant to perform. If a client uploads a requirement PDF, the client uploads it
through the UI; a seeded document row proves nothing.

External services in Phase 1 run in **test mode** (Stripe test keys, Clerk
development instance). That is allowed, provided the integration is real and
the limitation is documented. A hard-coded "payment succeeded" is not.

## 4. Missing dependency? Build it or report it

If the task needs something that does not exist yet (a screen, an endpoint, a
permission), do not work around it and call the task done. Build the
dependency if it is within the issue's scope; if it belongs to another issue,
report the task as blocked on it, by name.

## 5. Verify through the product, as each role

Primary acceptance is in the browser:
`sign in → navigate → click → enter data → submit → observe → reload`.
API and database checks are supporting evidence.

Test each affected role. If "the client sees the workspace and other clients
do not", sign in as the owning client, as another client, and as a developer
not on the team, and check all three.

If the environment blocks browser verification (no database, missing test
keys), that is a blocker to report, not a reason to lower the bar. State what
was verified, what was not, and what is needed.

## 6. Happy path, then failure paths

Walk the normal journey end to end, then the failures the spec cares about:
invalid input, missing required fields, wrong role, wrong project, full team,
duplicate application, unsupported or oversized file, failed or cancelled
payment, empty lists, loading, and a reload mid-flow. Each shows a clear state,
never a raw error or blank page.

## 7. Check the result against the spec

Not "something happened" but "the right thing happened": the open-spot count
dropped by exactly one; the team became `Active` only after the deposit webhook; the
project status matches the `nextnode-spec` state table; the signed file link
stops working after 15 minutes.

## 8. Report partial work as partial

```text
NOT DONE
Backend use case + API:  ✓
Migration:               ✓
Frontend UI:             ✗ not built
User workflow:           ✗ cannot be completed in the app
```

Never write "done", "complete" or "ready" while a required piece is missing.

## 9. Checklist

- [ ] Re-read the issue and its acceptance criteria.
- [ ] Identify the user role(s) and their complete workflow.
- [ ] Backend, frontend and UI connected to real data.
- [ ] Reachable through the app's navigation, not only by typed URL.
- [ ] Real input accepted; real action executes; result visible and correct.
- [ ] Persists across reload and a fresh sign-in.
- [ ] Loading, empty, validation, error, success and permission-denied states.
- [ ] Authorization checked for every relevant role and for the wrong project.
- [ ] Works at mobile, tablet and desktop widths.
- [ ] No console errors or hydration warnings.
- [ ] No seed or mock data masking missing functionality.
- [ ] Automated tests added and passing; lint and typecheck pass.
- [ ] Setup docs and `.env.example` updated if anything changed.
- [ ] Merged into `develop` through a reviewed PR.

## 10. Carry follow-ups forward

Anything found and deliberately not done becomes a named follow-up (new issue
or a comment on the closing issue), listed in the completion summary separately
from what was finished. "Out of scope" is a decision about this task, never a
decision to forget.

## 11. Final gate

> If the intended user got the app right now, could they use this feature from
> the UI and get the expected result?

If not, stop, find what is missing, and finish it before moving on.
