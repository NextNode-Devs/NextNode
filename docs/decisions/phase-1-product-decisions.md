# Phase 1 product decisions

Approved by the team lead on 27 Oct 2026. These override the source documents
where they conflict. The machine-readable copy Claude follows is
`.claude/skills/nextnode-spec/SKILL.md`; keep the two in step.

## Authentication and roles

- Clerk handles registration, Google sign-in and authentication. NextNode stores
  the Clerk user id and application profile data, never password hashes.
  *Supersedes:* class diagram `User.passwordHash`; proposal NFR on password
  hashing (Clerk owns credentials).
- "Clerk" is the external authentication service, **not** an administrator
  role. *Supersedes:* class diagram `Clerk` admin-role class. No admin role is
  built in Phase 1.
- Account roles are **Developer** and **Client**. **Team Lead is a
  project-specific responsibility held by a Developer**, not a registration
  role. A developer can lead one project and be a regular member of another,
  subject to project rules. *Supersedes:* proposal FR1 listing Team Lead as a
  registration role.

## Two kinds of project

| | Client-funded project | Developer-created project idea |
| --- | --- | --- |
| Created by | Client posts a brief | Developer proposes / publishes an idea |
| Team Lead | Hired by the client (Hire Lead) | The creating developer, automatically |
| Recruiting developers | Hire Devs | Hire Devs (same workflow) |
| Payments | Deposit before start; final payment on approval | None |

## Workflow A — Hire Lead (client-funded projects)

1. The client publishes a project.
2. A developer applies to lead that project, **or** the client invites a
   developer to lead it from the developer's portfolio.
3. Each application or invitation opens a hiring conversation between the
   client and that developer; the hiring decision happens there.
4. The client hires one Team Lead. Conversations with the other candidates are
   closed.
5. The Team Lead sets the team size and recruits developers (Workflow B).
6. Work begins only when the start conditions are met (timeline submitted,
   agreement signed, deposit confirmed by Stripe webhook).

## Workflow B — Hire Devs (both project kinds)

1. The project has a Team Lead.
2. The Team Lead sets the number of developer spots and opens them.
3. A developer applies to join, **or** the Team Lead invites a developer from
   their portfolio. Each opens a hiring conversation with the Team Lead.
4. An **application** becomes membership when the Team Lead accepts it. An
   **invitation** becomes membership only when the invited developer
   explicitly accepts it.
5. When every spot is filled, the remaining candidate conversations close.

Applying to **lead** a client project and applying to **join** a team are
different actions with different records, permissions and screens.

## Team size

A team is **5–7 people in total, including the Team Lead** (so 4–6 developer
spots). Enforced in the domain model.

## Payments

- Stripe **test mode** only, and only where genuinely integrated.
- Verified Stripe webhook events are the only proof a payment succeeded.
- Phase 1 tracks payment status. It does **not** provide escrow, fund custody,
  transfers, splitting or developer payouts, and the UI and documents must not
  say it does. The activity diagram's "Release Stripe Escrow" is recorded as a
  status change only.
- A payment step that cannot be completed safely is documented as a
  limitation, never faked.

## UML title correction

The activity-diagram titles "Hire Devs" and "Hire Lead" are swapped; see
`../spec/README.md`.

## Decisions of 27 Oct 2026 (second review)

- **Hiring chat uses WebSockets from Phase 1.** REST is used only for loading
  history and managing conversations. Design: `../proposals/realtime-messaging.md`.
- **Notifications are deferred.** No in-scope workflow depends on them
  (analysis in `../phase-1-scope-review.md`).
- **Uploads:** only what the sources require is considered (FR4 requirement
  documents, NFR2 private links); included in Phase 1 by the third review.
- **External accounts** (Clerk development instance, Stripe test account) are
  created when integration starts; placeholders until then.
- **Developer directory:** clients discover developers and invite them to
  *lead* their projects; developers applying to lead remains equally valid.
  Hiring a Team Lead is never the same action as recruiting into a team.
- **Agreement:** a basic in-app offer/agreement acceptance precedes the
  deposit on client-funded projects. Not a legal contract; no legal terms are
  invented.
- **Links:** developer-provided portfolio and GitHub URLs are accepted as
  given and never labelled "verified".

## Decisions of 27 Oct 2026 (third review — Phase 1 scope)

**Phase 1 direction approved: Phase 1 ends at project initiation.** The cut
and the reasons are in `../phase-1-scope-review.md`. Deferred items stay
source requirements in the backlog; they are not deleted.

- **In:** authentication and onboarding; developer portfolios and directory;
  client projects and developer-created project ideas; project discovery;
  both hiring workflows; authenticated WebSocket hiring chat; team
  recruitment (5–7 including the Team Lead); basic agreement acceptance;
  webhook-confirmed Stripe test-mode deposit for client-funded projects;
  basic private requirement-document uploads; minimal workspace chat at the
  start of the project.
- **Deferred:** milestones, revisions, final payment, project archiving,
  notifications (unless an in-scope workflow turns out to need one), document
  previews/deletion and other advanced document management, real escrow and
  payouts.
- **WebSocket placement:** connection authentication and the shared
  authorization foundation are built in #1; hiring conversations and
  hiring-specific behaviour in #4.
- **Channel layer:** Django Channels with **Redis** (`channels-redis`) for the
  multi-process channel layer, in local development (`docker-compose.yml`) and
  CI. `InMemoryChannelLayer` only in unit tests.
- **No pre-formed squad marketplace.** Client discovery is the developer
  directory plus project-specific hiring (Workflow A, then B). A squad
  directory is not built unless a source requirement is confirmed.
- **Both project kinds stay:** client-funded and developer-created.
- **No limit on projects led by one developer.** The class diagram's
  `TeamLead.maxActiveTeams` has no value; no limit is invented.

### Agreement and payment

- The offer acceptance records the **offer (agreement) version, the accepting
  user and the timestamp**; the Team Lead's signature records the same.
- No legal terms are invented. The screen says it is an in-app
  acknowledgement for a student prototype, not a legal contract, and nothing
  claims legal review.
- **Deposit rule — confirmed in the fourth review (below):** 20 % of the
  final accepted offer, in CAD, with a CAD 1,500 minimum project budget.
- Location-based currency was mentioned as an alternative. Phase 1 uses CAD
  only; per-location currency needs a defined location source and currency
  list first (open below).
- Stripe test mode only; a payment is confirmed only by a verified webhook
  event.

### Uploads

- Basic private requirement documents (FR4, NFR2) are in Phase 1.
- Behind a `FileStorage` port; the first adapter is **local private storage**
  (a git-ignored directory outside anything Django or Next.js serves). A cloud
  adapter can follow without changing use cases.
- The server validates type (extension **and** file signature: PDF or DOCX),
  size, count and authorization on every upload and every link request.
- **Limits (confirmed in the fourth review):** 10 MB per file, 10 files per
  project, as settings (`UPLOAD_MAX_BYTES`, `UPLOAD_MAX_FILES_PER_PROJECT`).
  These are the Team Lead's decision, not values from the source documents.
- **Applicant access (confirmed in the fourth review):** NFR2 says only
  "members of that specific project team" may view or download. So the
  client who owns the project, its Team Lead and its approved members can
  read documents; **applicants, invitees and lead candidates cannot**. They
  may read the brief's text.
- Download links expire after 15 minutes and re-check access when used.

## State flow derived from the class diagram

Client-funded project: `Posted` (brief published, Lead hired, team recruited)
→ `OfferSent` (Team Lead sends estimate + timeline and signs) → `Assigned`
(client accepts the offer) → `InProgress` (webhook-confirmed deposit).
Developer-created: `Posted` → `InProgress` when the Team Lead finalises the
timeline.

**Team states — confirmed in the fourth review.** The class diagram lists
`Open → Locked → Active → Archived` without saying what moves a team between
them. `Locked` = the roster is finalised and the project awaits its start
gate; `Active` = the project has met its start conditions and work has
begun. One transition each:

| State | Meaning | Entered when |
| --- | --- | --- |
| `Open` | Recruiting; applications and invitations allowed | Team created with the project (dev idea) or when the Lead is hired (client project) |
| `Locked` | Roster frozen; no applications, invitations or member changes; waiting for the start gate | Team Lead closes the project proposal (only when the team is full) |
| `Active` | Project started; workspace chat exists | Client project: webhook-confirmed deposit. Developer project: timeline finalised. Same moment the project becomes `InProgress` |
| `Archived` | Read-only | Project archived — deferred |

A declined offer leaves the team `Locked`; the Lead sends a revised offer.
Reopening recruitment (`Locked → Open`) is not described by any source and
is not built. The activity diagram's "Lock squad roster & enable dev chat
access" after the deposit maps to `Locked → Active`; the roster was already
frozen when the proposal closed.

**One team per project.** The class diagram allows one team to be assigned to
several projects, but both activity diagrams form the team inside a project
(the Lead spot and the developer spots belong to that project), and
`Project.assignTeam(team)` gives a project a single team. Phase 1 therefore
uses one team per project and one project per team (confirmed in the fourth
review). This is consistent with the workflows and narrower than the class
diagram: reusing a team on a second project is what a pre-formed squad would
need, and that is not built.

## Decisions of 27 Oct 2026 (fourth review — confirmed by the Team Lead)

"Team Lead" in this section means the group's team lead (GitHub
`shar-hylton`), not the in-product project role. These decisions could not be
cross-checked against the source PDFs, which are not yet in `docs/spec/`; no
conflict with them is claimed.

- **Deadline: 1 November 2026** for Phase 1.
- **Scope boundary unchanged:** Phase 1 ends at project initiation; the
  deferred list above stands.
- **Budget is a proposal.** The budget on a client's project listing is the
  client's proposed budget. The client and the project's Team Lead may
  negotiate it (in their existing hiring conversation, then through offer
  versions: the client declines with a reason, the Lead sends a revised
  offer). Nothing is calculated from the listing budget.
- **Minimum project budget: CAD 1,500.00**, enforced by backend domain
  validation (not only the UI) on the brief's proposed budget (#3), on every
  offer total (#6) and again when the deposit checkout is created (#7).
  Applying it to the offer total follows from the offer being the final
  project budget.
- **Currency: CAD only** in Phase 1. Amounts are stored in whole cents.
- **Deposit: 20 % of the final accepted offer total**, payable at project
  initiation (after the client accepts the offer, before the project
  starts). Computed on the server from the accepted offer version, in whole
  cents (half-cent rounds up), never taken from the browser. `DEPOSIT_PERCENT`
  stays a setting (default `20`) because the rule may change in a later
  phase. At the CAD 1,500 minimum the smallest deposit is CAD 300.00, well
  above Stripe's minimum charge.
- **Payment confirmation:** only a verified Stripe webhook event (signature
  checked on the backend, duplicate deliveries ignored by Stripe event id)
  marks a deposit `Completed`. A browser redirect from Checkout never does.
- **Stripe ownership:** the Team Lead (`shar-hylton`) owns Stripe setup, the
  test account and credentials, integration decisions, payment testing and
  verification, in a separate issue (#7) assigned to them. Keys live only in
  git-ignored `.env` files and GitHub environment secrets, never in
  documents, issues or YAML. Non-payment start-gate work stays in #6 for
  shared allocation.
- **Private documents:** applicants and invited candidates cannot access
  them and may read the brief; the owning client, the Team Lead and approved
  team members access them through links that expire after 15 minutes.
- **Upload limits:** 10 MB per file, 10 files per project.
- **Team states:** `Locked` = roster finalised, awaiting the start gate;
  `Active` = start conditions met, work has begun (table above).
- **One team per project** in Phase 1.
- **Workspace chat:** project team members only (Team Lead and approved
  members); the client is excluded.

## Decisions of 28 Oct 2026 (fifth review — Phase 1 is the MVP build)

Confirmed by the Team Lead:

- **Phase 1 is the MVP build.** The team works only on coding tasks that
  implement the workflow recorded in this document (the "correctness" of the
  UML diagrams means this workflow, not the diagrams' exact drawing).
- **ER diagram (NN-27): not in Phase 1.** ER diagrams are reference material;
  the Phase 1 brief does not ask for one. No task is assigned.
- **Source PDFs and activity-diagram correction (NN-23): not in Phase 1.** The
  Team Lead is aware the activity diagram is partly inaccurate; this document
  is the reference for the workflow.
- **Submission documents (NN-22)** — progress report, setup instructions,
  task distribution sheet, prototype zip — are written after the build, from
  merged work, with the Team Lead. They are not team tasks.
- **CI and Stripe (#7):** CI uses a fake payment gateway; no Stripe secret is
  stored in GitHub. Webhook tests sign payloads with a generated secret.

## Decisions of 29 Oct 2026 (#1 implementation, issue owner)

- **Skills are typed by developers**, not chosen from a predefined list. This
  replaces "skills from a fixed list" in #1 and the `ui-ux` guideline that
  skill tags are not free text. To keep one spelling per skill, the backend
  trims and collapses whitespace, compares case-insensitively (`react` =
  `React`; the first spelling saved is kept), allows letters, digits, spaces
  and `+ # . - /`, at most 40 characters per skill and 1–20 per developer, and
  refuses duplicates. Every saved skill is listed by `GET /api/skills/?q=` and
  the onboarding form suggests them while typing. #2 (portfolio, directory
  filter) and #3 (tech stack) read from that endpoint rather than defining
  their own list. Limits live in `nextnode.domain.accounts`.
- **Onboarding fields:** both roles give a display name. Client: company name
  and industry (free text). Developer: headline, optional bio, optional GitHub
  username (accepted as provided, never "verified") and skills. #2 extends the
  developer profile into the portfolio (URLs, availability).

## Open conflicts and decisions still needed

1. **Location-based currency:** wanted in a later phase? If so, from which
   location (client profile country? billing address?) and which currencies.
   Nothing in Phase 1 depends on it.
2. **Time-limited invitation links** (FR3): deferred; in-app invitations
   cover the diagrams.
3. **Activity diagram omission:** no "Close Project Proposal"/"Sign
   Agreement" step in the activity diagram (the use case diagram has them).
   Placed after the team is full, before the deposit.
4. **CI with Clerk:** authenticated end-to-end tests in CI need Clerk
   development keys stored as GitHub environment secrets (admin action).
5. ~~CI with Stripe~~ — decided 28 Oct 2026: fake payment gateway in CI.
6. ~~Source documents~~ — decided 28 Oct 2026: not required for Phase 1.
