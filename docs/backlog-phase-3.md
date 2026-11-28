# NextNode backlog: Phase 3 (Final Prototype)

Created 28 Nov 2026. **Due 6 Dec 2026; target 5 Dec.** Owners and the
decisions below confirmed by the Team Lead (`shar-hylton`) on 28 Nov 2026;
the items still open are listed at the end.

Sources: the Phase 3 brief (`docs/submission/reference/Phase_3.pdf`, git-ignored),
Stakeholder Meeting 2 (Mangesh Bhattacharya; questions Q1–Q6 and the team
reflections, `docs/submission/reference/Stakeholder_Meeting_2_NextNode.docx`),
the Team Lead's instructions of 28 Nov 2026. Phase 2 backlog:
`backlog-phase-2.md`. Rules: `decisions/phase-2-product-decisions.md` until a
Phase 3 decisions file replaces the parts that change.

## GitHub issues (created 28 Nov 2026)

Milestone "Phase 3: Final Prototype" (due 6 Dec), label `phase-3`, org
Project #5 "Phase-3". Parents: Track A #172, Track B #173; each lists its
items as sub-issues, and "blocked by" links show the dependencies.

| Item | Issue | Owner | Blocked by |
| --- | --- | --- | --- |
| A0 | #174 | `shar-hylton` (Claude) | — |
| A1 | #175 | `shar-hylton` (Claude) | — |
| A2 | #176 | `shar-hylton` (Claude) | A1 |
| A3 | #177 | `shar-hylton` (Claude) | A0 |
| A4 | #178 | `shar-hylton` (Claude) | — |
| A5 | #179 | `shar-hylton` (Claude) | A0 |
| A6 | #180 | `shar-hylton` (Claude) | — |
| A7 | #181 | `shar-hylton` (Claude) | A2, A0 |
| A8 | #182 | `shar-hylton` (Claude) | A7 |
| A9 | #183 | `shar-hylton` (Claude) | — |
| A10 | #184 | `shar-hylton` (Claude) | A0 |
| A11 | #185 | `shar-hylton` | — |
| NN-53 | #194 | `Isabella-Enriquez` | — |
| NN-43 | #186 | `Hardik33` | A0 |
| NN-44 | #187 | `Isabella-Enriquez` | — |
| NN-45 | #188 | `AliyaaAli` | NN-43, A1 |
| NN-46 | #189 | `AliyaaAli` | — |
| NN-47 | #190 | `KaiNabea` | — |
| NN-48 | #191 | `jayparmarsectionA` | A0 |
| NN-49 | #192 | `Kaushalya-123` | A5, A3 |
| NN-50 | #193 | `Isabella-Enriquez` | — |
| NN-52 | #195 | `KaiNabea` | — |
| NN-51 | #196 | `shar-hylton` | — |

## What Phase 3 changes

The brief asks for a **fully functional** final prototype. Phase 2 screens run
on typed sample data, so Phase 3 is about **real backends, not only UI**:

1. **Track A: real backends for the Phase 2 screens.** Each Phase 2 item's
   "Backend note" is built for real, and the screen's `sample.ts` is replaced
   by the API, with no change to the screen's shape.
2. **Track B: Stakeholder Meeting 2 features**, owned by the members whose
   reflections claimed them.
3. **Track C: submission**: final zip, documentation, video, task sheet.

Rules that still hold: Phase 1 flows keep working; payments stay Stripe test
mode with webhook-confirmed status and no held funds or payouts (holding is
still shown "Planned"); legal wording stays "To be defined"; no file over
500 lines; teams are 5–7 including the Lead; Hire Lead and Hire Devs stay
separate.

## Schedule

| Dates | Work |
| --- | --- |
| 28–29 Nov | A0 shared contracts merged first; issues and the Phase-3 board |
| 29 Nov–3 Dec | Track A slices and Track B features |
| 3–4 Dec | Cross-testing and refinement; Phase 1 e2e stays green |
| 4–5 Dec | Documentation, task sheet, video, zip |
| 5 Dec (latest 6 Dec) | Submit |

## Dependency rules (Team Lead, 28 Nov 2026)

- **Isabella is free of dependencies.** Her items need nothing that someone
  else builds, and nobody waits for her: anything another member reads from
  her work is either created early in A0 (below) or optional (`null` until
  her slice lands).
- **Nothing of Jayraj's blocks two or more PRs.** The pieces others would wait
  for (account status and the access-denied reasons) are created early in A0,
  so every member builds against them from day one. Jayraj keeps the flows
  themselves: pausing, resuming and deleting an account, the retention rules,
  the paused-Lead case, and the signed-out gate.
- Everyone else depends only on A0 and on **written contracts** (shapes in
  this file), never on another member's unmerged branch.
- **Migrations:** each slice keeps its models in its own module (as
  `certificate_models.py` does). Before merging, rebase on `develop` and
  renumber your migration if someone else's landed first.

## A0 · Shared contracts (first, small; Claude)

Merged before anyone starts, so nobody waits on Jayraj or Isabella:

- `Account.status`: `active` | `paused` | `deleted` (default `active`), with a
  migration, the domain rule `is_visible()` and a test. Paused and deleted
  accounts are left out of the directory, the feed and suggestions.
- `FORBIDDEN` errors may carry `details.reason`: `left`, `removed`,
  `replaced_as_lead`, `account_paused`, `account_deleted`, plus `at`
  (ISO time). Aliya's access screen reads these.
- `Project.confidential` (bool, default false), returned on the project.
  Isabella's toggle sets it; Kai's portfolio update reads it.
- A `Notification` port in `application/ports.py`, with a store that does nothing
  until A3 lands, so Hardik's and Kai's slices can send notifications on day
  one.

## Track A · Real backends for Phase 2 screens

Built by Claude (Team Lead, 28 Nov) unless marked; the owner then wires their
screen to the API, keeps their tests green and does the client-wording pass
(B7). Order matters only where noted.

| # | Slice | From | Screen owner |
| --- | --- | --- | --- |
| A1 | Offer milestones: milestone rows on the offer version (3+), amounts add up, deposit % (20–40, steps of 5), release milestone 1 or 2 on acceptance | NN-16a #94 | Aliya |
| A2 | Milestone delivery and review: `submit`, `approve`, `request_revision`, review history; approving starts the next one (needs A1) | NN-16b #95 | Kai |
| A3 | Notifications: model, `GET /api/notifications/`, mark read, settings per category, push over the WebSocket | NN-19 #89 | Kaushalya |
| A4 | Time-limited invite links: signed single-use token, expiry 24 h / 3 d / 7 d, one active per team, revoke | NN-26 #90 | Kaushalya |
| A5 | Dashboard read model `GET /api/dashboard/`: roles incl. Assistant Lead, `has_access`, attention items, inbox tabs and unread counts; progress per project (B6) once A1/A2 exist | NN-32 #88 | Kaushalya |
| A6 | Server-side match score and suggested developers (`scoreMatch` moves to the API; the reason text stays) | NN-33 #91 | Kaushalya, Hardik |
| A7 | Final approval, archive, portfolio entries (never confidential; needs A2) | NN-17 #97 | Kai |
| A8 | Ratings and Team Lead references (after `Completed`) | NN-35 #98 | Kai |
| A9 | Junior spots on the team (at most `open_spots`) | NN-36 #99 | Kai |
| A10 | Replacement: `Left`/`Removed` membership, Lead proposal → client approval → co-signature on the current offer, inactivity banner after 3 days, access-lost reasons | NN-38 #100 | Hardik, Aliya |
| A11 | Payments: receipts for every payment, cancel and refund the deposit minus Stripe's fee (read from the balance transaction), fees panel from real data | NN-37 #96 | **Tavoiri** |

Not in Track A (owned elsewhere):
- **NN-53 · Workspace backends**: NN-15b and NN-41 for real (VideoLink and
  ProjectUpdate models, the confidential toggle saving to the A0 field) are
  **Isabella's**, end to end. The dashboard's "latest update" (A5) is `null`
  until NN-53 lands, so nobody waits for it.
- NN-39 and NN-34 are already real (Jayraj, 21 Nov).

## Track B · Stakeholder Meeting 2 features

**NN-43 · "Interested" requests and project handover**. Hardik. Trace: Q1.
- an "Interested" button on a developer-created project (clients only) opens a
  pop-up to message the developer about it
- the developer gets a request (notification kind `interest_request`) and
  accepts it, which creates a direct conversation (the new conversation kind
  from NN-32)
- if the contacted developer isn't the project's Team Lead: a "Request Team
  Lead" button adds the Lead to the conversation
- **only the Team Lead** sees "Hand over to client"; the client accepts the
  handover, and the project enters the client-project workflow (NN-45)
- Contract for others: `POST /api/projects/{id}/interest/`,
  `POST /api/interest/{id}/accept/`, `POST /api/projects/{id}/handover/`,
  `POST /api/handovers/{id}/accept/`; handover states
  `Offered → Accepted | Declined | Withdrawn`.

**NN-44 · Client stars on developer projects**. Isabella. Trace: Q1.
- clients star a developer-created project; the star count shows on the
  project card and page (the "competition" signal), with the "Interested"
  button beside it (Hardik's; the star doesn't need it)
- one star per client per project, removable; developers see the count only
- backend: a Star model in its own module, `POST/DELETE
  /api/projects/{id}/star/`, `star_count` and `starred_by_me` on the project

**NN-45 · Handed-over project enters the start gate**. Aliya. Trace: Q1, Q5.
- after the handover is accepted, the client edits the brief, uploads
  documents, and the Lead sends an offer with milestones (A1); the client
  accepts and pays the deposit as in Phase 1 (the existing team stays)
- builds against the NN-43 contract with a sample handover until Hardik
  merges

**NN-46 · Feature changes after signing ("Features" tab)**. Aliya. Trace: Q5.
- the client adds or removes requirements after the offer is signed
- a "Features" tab on client projects: each change is a card with a "New"
  badge and its date; the team sees exactly what changed
- the Team Lead accepts (which leads to a revised offer through the start gate)
  or declines with a reason
- backend: FeatureChange (`kind` add/remove, text, `created_at`, `status`
  `Proposed → Accepted | Declined`, `seen_by`); the "New" badge stays until
  the viewer opens it

**NN-47 · Shareable view-only portfolio link**. Kai (portfolio owner since
#2). Trace: Q4.
- "Share portfolio" on the developer's own portfolio: copy a link
  (Kaushalya's shared copy-link button, B6), revoke it, make a new one
- the link opens a read-only page for anyone, signed in or not, showing only
  public fields (no email, no certificates' files, no private comments)
- backend: an unguessable share token per developer, revocable;
  `GET /api/share/portfolios/{token}/` is the only public data endpoint and is
  rate-limited; every other endpoint stays authenticated

**NN-48 · Account pause and delete; signed-out gate**. Jayraj. Trace: Q4, Q6.
- Settings → Account: pause (hidden from directory, feed and suggestions;
  can't be messaged; resume any time) and delete permanently (confirm twice;
  deletes the Clerk user)
- deletion removes the profile, portfolio, certificates and share link; it
  keeps messages, payments, offers and agreement acceptances, because other
  people's records depend on them. Kept records show the person as
  **"NextNode User"** (Team Lead, 28 Nov)
- a paused Team Lead must not leave a team stuck: the Lead-unresponsive flow
  (A10) or the Assistant Lead election (NN-39) starts straight away
- signed-out visitors who open any secured page go to sign-up, then the
  normal role choice (Developer or Client), then back to the page; the API
  keeps answering `401` (it never redirects)
- uses `Account.status` and the reasons from A0; nobody waits on this item

**NN-49 · Client-friendly dashboard and progress**. Kaushalya. Trace: Q3, Q1.
- a progress bar per client project: milestones done of total, what's due
  next, amount paid of total (from A5)
- a "What to do next" line for clients, in plain words
- the copy-link button becomes a shared molecule (`shared/ui/molecules`) used
  by invite links and NN-47
- the bell renders `interest_request`, `handover_offered`,
  `feature_change` notifications

**NN-50 · First-time guide and client wording**. Isabella. Trace: Q3.
- a short, dismissible "How NextNode works" guide for first-time clients, with
  its own page `/guide` (posting a brief, hiring a Lead, milestones,
  payments, and buying a developer project); Isabella mounts the guide card on
  the dashboard herself
- the client wording pass on her own screens (workspace tabs, confidential,
  search, locked tabs)

**NN-52 · Jobs**. Kai. Trace: Q2 (in scope, Team Lead, 28 Nov).
- a "Jobs" tab in the navigation. **Clients post** small tasks; developers
  browse and take them, finish the work, share the code files, and the client
  approves
- each job is a card: description, skills required, proposed timeline (start
  date and due date)
- **a job lasts at most one month**: the due date is at most one calendar
  month after the start date
- **no past dates**: the start and due dates can't be before today, checked
  in the form and again by the API
- **expired jobs never appear in developer feeds**: once the due date has
  passed, an open job is left out of the feed and its API listing; the client
  still sees it on their own jobs, marked "Expired"
- one developer takes a job; the client can't take their own
- states: `Open → Taken → Submitted → Approved`, with `Expired` for an open
  job past its due date (worked out from the date, never stored by hand)
- backend: Job and JobSubmission in their own module; files through
  `FileStorage` with the document rules; `GET /api/jobs/` (developers: open,
  not expired), `POST /api/jobs/` (clients), take, submit, approve
- paying the developer: shown "Planned" until the payment side is built
  (Tavoiri, A11); no funds are held or paid out

**B7 · Client wording on every screen** (each owner, on their own screens).
Use the glossary below on client-facing screens; developer screens keep the
technical words.

| Instead of (client side) | Say |
| --- | --- |
| Repository | Code link |
| Tech stack | Tools and languages |
| Milestone status | Progress |
| Deposit release milestone | When the deposit is paid to the team |
| Under review | Waiting for your check |

## Track C · Phase 3 submission

**NN-51 · Final submission**. Tavoiri, with Claude drafting.
- `Project_Prototype_Final_Group1.zip` (no `.env`, `node_modules`, `.venv`,
  build output)
- `Project_Documentation_Final_Group1.docx`: installation guide, project
  overview, environment setup, libraries and tools with versions,
  undelivered features with reasons
- `Task_Distribution_Final_Group1.docx`: every member across Phases 1–3 —
  development, documentation, testing, stakeholder feedback
- `Presentation_Group1.mp4`: 10–15 minutes, every major function, the user
  flow, challenges and solutions (each member presents their own features)

## Testing and refinement

Same rule as Phase 2: owners test their own work, Tavoiri reviews before
merge, a second member tests each area at 375, 768 and 1280 px with the
keyboard only. Track A slices ship with pytest coverage and keep the Phase 1
e2e suite green.

| Area | Tester |
| --- | --- |
| Interested and handover (Hardik) | Aliya |
| Start gate for handed-over projects, Features tab (Aliya) | Hardik |
| Stars, guide, wording (Isabella) | Kaushalya |
| Dashboard progress, bell kinds, copy link (Kaushalya) | Isabella |
| Share link, Jobs (Kai) | Jayraj |
| Pause, delete, signed-out gate (Jayraj) | Kai |
| Track A slices | each screen owner, through their own screen |

## Decided 28 Nov 2026 (Team Lead)

- Due 6 Dec 2026.
- Jobs are in scope (NN-52, Kai); clients post them.
- Account deletion as in NN-48; kept records say "NextNode User".
- **Paid fixes after a project is finished are Jobs (NN-52)**, not the
  Features tab. The Features tab (NN-46) is only for projects still being
  built. For now both are plain tabs; a later sprint may move the Features tab
  into a sidebar on the client and developer project pages.
- **Checkout charges the deposit % agreed on the offer** (A1, #175). An
  offer without milestones still pays the default `DEPOSIT_PERCENT`. This
  replaces the Phase 2 rule that the live deposit stays at the default.
- **Credit for Track A goes to each screen's owner** in the task sheet. Claude
  builds those backends only to remove dependencies, so the team isn't held
  up if a feature runs late.

## Still open (Team Lead)

1. **Ownership after handover and code access** (Q1, Q2): who owns the code
   and how the team splits the money. Until it's decided, screens show
   "To be defined", as the legal panel does today.

## Future build (not Phase 3)

- **GitHub repositories through a NextNode GitHub App** (#199, Team Lead;
  don't build until the Team Lead says so):
  - the repository sits in the client's account
  - a repository admin (the Lead or a named senior developer) sets up the
    template, CI and branch protection
  - access is kept in step with the team, and Jobs developers get access to
    their branch only, for that job
  - an NDA acknowledgement comes before any access
  - webhooks bring CI status and preview links onto the project page
  
  Phase 3 Jobs stay file-based. Two-step sign-in is required for
  repository admins; the security notes are on #199.
- **Developer identity screening** (#201, Team Lead; a last-minute task near
  the end of the project): ID and face verification through a provider
  before a developer works on client projects or jobs, with the records kept
  for legal purposes; privacy terms "To be defined".
