---
name: nextnode-spec
description: Read before implementing or changing any NextNode product behaviour. Maps the project proposal, use case, class and activity diagrams plus the team's approved decisions to roles, the two hiring workflows (Hire Lead, Hire Devs), client-funded vs developer-created projects, states, invariants, out-of-scope items and the conflicts still open.
---

# NextNode product spec → code

NextNode is a collaborative freelance marketplace: developers form
project-based squads, build software for clients (founders, small businesses)
or for their own portfolios, and the shipped work lands in verified
portfolios. *Build as a squad. Ship real projects. Prove it in your portfolio.*

## Sources of truth, in order of precedence

1. **Approved decisions** recorded in this skill (§ Approved decisions) and in
   `docs/decisions/`. They override the documents where they conflict.
2. The source documents, to be stored in `docs/spec/` (see its README for
   which are present):

| Document | Decides |
| --- | --- |
| CPAN314 Project Proposal (Group 1) | Scope, MVP, functional + non-functional requirements, stack |
| Use Case Diagram + workflow description | Actors, use cases, include/extend |
| Class Diagram + description | Domain model, multiplicities, state enums |
| Activity Diagrams (main, Hire Team Lead, Hire Devs) | Workflow order, branches, system actions |
| Phase 1: Initial Prototype Development | What Phase 1 must deliver and submit |

When sources disagree and no decision covers it, do not pick silently: add it
to § Open conflicts and ask.

## Approved decisions (27 Oct 2026)

**Authentication.** Clerk handles registration, Google sign-in and
authentication. NextNode stores the Clerk user id and application profile
data, never passwords. This supersedes the class diagram's
`User.passwordHash` and the proposal's password-hashing NFR (Clerk owns
credentials). "Clerk" is the external auth service only, **not** an admin role;
the class diagram's `Clerk` admin class is not built.

**Role model.** Account roles are **Developer** and **Client**, chosen at
onboarding. **Team Lead is a project-specific responsibility held by a
Developer**, recorded on that project's team membership, not a registration
role. This supersedes the proposal's FR1 listing Team Lead as a registration
role. A developer may lead one project and be a regular member of another,
subject to project rules.

**Team size.** A team is **5–7 people in total, including the Team Lead**, so
a Team Lead opens 4–6 developer spots.

**Two kinds of project.** Keep them distinct in the model, API and UI.

| | Client-funded project | Developer-created project idea |
| --- | --- | --- |
| Created by | Client posts a brief | Developer proposes/publishes an idea |
| Team Lead | Hired by the client via **Hire Lead** | The creating developer, automatically |
| Recruiting devs | **Hire Devs** | **Hire Devs** (same workflow) |
| Focus | Logistics: schedule, team size, budget | Functionality and design |
| Payments | Deposit before start, final payment on approval | **None** |
| Start gate | Timeline submitted + webhook-confirmed deposit | Timeline finalised |
| Completion | Client reviews milestones, approves, pays | Team Lead decides it is complete |

**Payments.** Stripe **test mode**, only where genuinely integrated. Verified
Stripe webhooks are the sole authority for confirmed payment status. Phase 1
**tracks** payment status; it does **not** provide escrow, fund custody,
transfers, splitting or developer payouts, and must never say it does. The
activity diagram's "Release Stripe Escrow" is a recorded status change
("released"), labelled as such in the UI. A payment step that cannot be
completed safely is documented as a limitation, never faked.

**Hiring conversations use WebSockets from Phase 1** (decision 27 Oct 2026).
REST only loads history and manages conversations; messages are sent and
received over an authenticated WebSocket. Design:
`docs/proposals/realtime-messaging.md`.

**Developer discovery.** Clients can browse and filter developer portfolios
and invite a developer to *lead* one of their projects from the portfolio.
Developers applying to lead remains an equal entry point. Inviting a developer
to *lead* (client, Workflow A) is never the same action as a Team Lead
inviting a developer to *join* (Workflow B).

**Agreement (client-funded only).** A basic in-app offer and agreement
acceptance precedes the deposit. Each signature and acceptance records the
offer (agreement) version, the user and the timestamp. It is not a legal
contract, has not been legally reviewed, and must not be presented as either.
No legal terms are invented; missing terms are listed in
`docs/phase-1-scope-review.md`.

**Budget and deposit (confirmed 27 Oct 2026).** Phase 1 uses **CAD only**,
stored in whole cents. The budget on a client's listing is a **proposal**
the client and Team Lead may negotiate (hiring conversation, then offer
versions). **Minimum project budget CAD 1,500.00**, enforced in backend
domain validation on the brief, every offer total, and at checkout. The
**deposit is 20 % of the final accepted offer total**, payable at project
initiation, computed on the server from the accepted offer version (half-cent
rounds up), never from the browser. `DEPOSIT_PERCENT` is a setting (default
`20`); the rule may change in a later phase. Stripe setup, credentials and
payment verification belong to the group's Team Lead (`shar-hylton`) in #7.

**Requirement documents.** PDF/DOCX behind a `FileStorage` port, local private
storage first. The server validates type (extension and signature), size,
count and access. Readers: the owning client, the Team Lead and approved
members. **Applicants and invited candidates cannot read them**; they may
read the brief. Limits (confirmed): 10 MB per file, 10 files per project.

**Discovery.** No pre-formed squad marketplace. **One team per project**
(confirmed). No limit on how many projects one developer leads.

**Deadline.** Phase 1 is due **1 November 2026**.

**Links.** Developer-provided portfolio and GitHub URLs are accepted as
given. Nothing is labelled "verified" and no verification is built.

**Notifications** (FR8) are deferred unless an in-scope workflow needs one.
**External accounts** (Clerk development instance, Stripe test account) are
created when integration work begins; until then placeholders only.

**UML title swap.** The activity-diagram page titled "Hire Devs" depicts the
client hiring a Team Lead; the page titled "Hire Lead" depicts the Team Lead
hiring developers. The workflows below define the meaning. Details:
`docs/spec/README.md`.

## Workflow A — Hire Lead (client-funded projects only)

1. Client publishes a project brief (title, scope, tech stack, budget, target
   delivery; private PDF/DOCX requirement documents) and opens the Team Lead
   spot.
2. Two entry points, both allowed:
   - a Developer **applies to lead** that project (showcasing their profile);
   - the Client **invites** a Developer to lead, from the developer's
     portfolio or the developer directory.
3. Each application or invitation opens a **hiring conversation** between the
   client and that developer. The decision happens there.
4. The Client hires one Team Lead. The system fills the role and **closes the
   conversations with every other candidate** for that spot.
5. The Team Lead sets the team size (5–7 total) and starts **Hire Devs**.
6. Work begins only when the start conditions are met (§ Project start).

## Workflow B — Hire Devs (both project kinds)

1. The project has a Team Lead (hired via A, or the creator of a dev idea).
2. The Team Lead sets the number of developer spots (team total 5–7) and opens
   them.
3. Two entry points, both allowed:
   - a Developer **applies to join** the team;
   - the Team Lead **invites** a Developer from their portfolio.
4. Each application or invitation opens a **hiring conversation** between the
   Team Lead and that developer.
5. Membership:
   - an **application** becomes membership when the **Team Lead accepts** it;
   - an **invitation** becomes membership only when the **invited developer
     explicitly accepts** it.
   Each new member reduces open spots by one. A spot cannot be over-filled.
6. Repeat until all spots are filled; then the system closes the remaining
   candidate conversations.
7. The team works on the project.

**Never conflate** applying to *lead* a client project (A) with applying to
*join* a team (B). They are different records, permissions and screens.

## Project start, delivery and close

- **Client-funded:** team full → Team Lead closes the proposal (team
  `Locked`) → Team Lead sends the **offer** (estimate + timeline) and signs →
  project `OfferSent` → client reviews and **accepts** the offer/agreement →
  project `Assigned` → client pays the deposit (Stripe Checkout, test mode) →
  on the **webhook-confirmed** deposit: team `Active`, project `InProgress`,
  workspace chat created → development → Team Lead submits milestone work →
  client approves or requests revisions (loop) → client makes the final
  payment → payment marked released (no payout), conversations greyed out,
  project archived, developers' portfolios updated.
- **Developer-created:** team full → Team Lead closes the proposal (team
  `Locked`) → Team Lead finalises the timeline → team `Active`, project
  `InProgress`, workspace chat created (no offer, no payment) → development → Team Lead marks the project complete → archive and
  update portfolios.

`Assigned` therefore means **the client accepted the team's offer** (class
diagram `sendOfferToClient` / `reviewOffer` / `assignTeam`), not "a Lead was
hired". Hiring a Lead and recruiting leave a client project `Posted`.

## States (class diagram)

| Object | States |
| --- | --- |
| Project | `Posted → OfferSent → Assigned → InProgress → Completed → Archived` |
| Team | `Open → Locked → Active → Archived` |
| TeamMembership | `Pending → Approved` / `Rejected`; role `Lead` / `Member` |
| Payment | `Pending → Completed` / `Failed`; `Completed → Refunded`; type `Deposit` / `FinalPayment` |
| Milestone (proposal FR6) | `Pending Deposit → In Progress → Under Review → Completed` |

Team states (confirmed): `Open` = recruiting; `Locked` = roster finalised
after the Lead closes the proposal, awaiting the start gate; `Active` = start
conditions met and work has begun; `Archived` = deferred. A declined
offer leaves the team `Locked`; `Locked → Open` is not built.

Transitions are methods on the domain entity that refuse illegal moves with
`InvalidStateTransitionError`. Never set a status field directly.

## Invariants that must not be softened

Enforced in domain entities and use cases, not in views or forms.

1. **Team Lead is a Developer**, per project. A client can never hold it. A
   developer-created project assigns its creator as Lead automatically.
2. **One Lead per project.** Hiring a lead closes all other lead candidates'
   conversations for that project.
3. **5 ≤ team size ≤ 7, Lead included.** Accepting a member decrements open
   spots atomically; acceptance that would exceed the size is refused.
4. **Invitations need the invitee's acceptance; applications need the Team
   Lead's (or, for A, the client's) acceptance.** Nobody is added to a team
   without the consent the workflow requires.
5. **Start gate.** Client-funded: the team is full, the client has accepted
   the Team Lead's signed offer, and the deposit is webhook-confirmed — only
   then does the team become `Active` and the project start. Developer-created:
   team full, proposal closed and timeline finalised. No offer, agreement or payment records exist
   for developer-created projects.
6. **At most two payments per client project**, one `Deposit`, one
   `FinalPayment`; the final only after client approval. Payment state changes
   only on a verified webhook (signature checked, duplicate events ignored);
   a browser redirect never confirms a payment; a failed or abandoned
   checkout changes nothing else.
7. **Access.** A hiring conversation is visible only to its two participants.
   The Phase 1 workspace chat is for team members only; the client is
   excluded. Team-internal assets only reach that team's approved members.
8. **Private files.** Requirement documents are visible only to the owning
   client, the Team Lead and approved members — never applicants or
   candidates — via links that expire after 15 minutes and re-check access.
9. **Soft deletion.** Projects, teams, agreements, conversations and payments
   are archived, never hard-deleted.
10. **No invented data.** No seed or mock record may stand in for a workflow the
    user is meant to perform (see `nextnode-definition-of-done`).
11. **Minimum budget.** A client project's proposed budget and every offer
    total are at least CAD 1,500.00; the backend refuses less.

## Hiring conversations (approved: WebSockets)

- One `Conversation` (+ `Message`) model, linked to the lead application,
  lead invitation, team application or team invitation it belongs to, or
  the project workspace (team members only), with participants and `closed_at` /
  `closed_reason`.
- Messages persist before they are broadcast. Only participants can
  subscribe, read or post; a closed conversation is read-only.
- Accept / decline / hire actions live **inside** the conversation view and
  are broadcast to both participants.
- WebSocket auth: Origin check, Clerk token in the first frame (never in the
  URL), re-auth before expiry. Full design and tests:
  `docs/proposals/realtime-messaging.md`. Channel layer: Redis (approved),
  in local development and CI. Socket authentication and shared
  authorization are built in #1; hiring behaviour in #4.

## Out of scope

Advanced automated billing reconciliation; public analytics feeds; external
co-op auditing portals; escrow, fund custody, transfers and developer payouts;
an admin role or console; a self-built mail server; in-app video (a meeting is
a link to a third-party host); anything the sources do not name (ratings,
bidding, extra roles).

Deferred by decision (still requirements): notifications (FR8); milestones,
revisions, final payment, archiving; document previews/deletion; workspace
extras; time-limited invitation links; hosting. Not built: link verification;
a pre-formed squad marketplace.

**Phase 1 ends at project initiation** (direction approved 27 Oct 2026):
`docs/phase-1-scope-review.md`. Do not build deferred items in Phase 1.

## Open conflicts (record; do not guess)

The deposit, budget minimum, upload limits and access, team states, one team
per project, workspace participants and deadline were confirmed on 27 Oct
2026 (above). Still open:

1. **Source documents not in the repository.** Adding them is not part of
   Phase 1 (Team Lead, 28 Oct 2026); the workflow in this skill and
   `docs/decisions/phase-1-product-decisions.md` is the reference. Do not
   invent a source requirement that cannot be checked; ask. The ER diagram
   is reference material only, not a Phase 1 deliverable.
2. **Activity diagram omission.** No "Close Project Proposal"/"Sign
   Agreement" step in the activity diagram; placed after the team is full,
   before the deposit.
3. **Per-location currency** is a possible later option, not Phase 1.

## Where each part lives in code

| Spec | Backend (`backend/nextnode/`) | Frontend (`frontend/src/`) |
| --- | --- | --- |
| Accounts, roles, onboarding | `domain/accounts`, `infrastructure/auth` (Clerk) | `features/complete-onboarding` |
| Portfolio | `domain/portfolios` | `entities/developer`, `views/portfolio` |
| Projects (both kinds), documents | `domain/projects`, `infrastructure/storage` | `entities/project`, `features/post-project-brief`, `features/propose-project-idea` |
| Hire Lead | `application/use_cases/hiring` | `features/apply-to-lead`, `features/invite-lead`, `features/hire-team-lead` |
| Hire Devs, roster | `domain/teams`, `application/use_cases/teams` | `features/apply-to-join`, `features/invite-developer`, `features/accept-invitation` |
| Conversations | `domain/conversations` | `widgets/conversation` |
| Payments (#7 backend, Team Lead; #26 frontend) | `domain/payments`, port `PaymentGateway` | `features/make-deposit`, `features/make-final-payment` |

Create these only when a backlog item needs them.

## Adding behaviour

1. Find the requirement above or in the sources. If it is not there, ask.
2. Backend inside out per `backend-architecture`; frontend per
   `frontend-architecture`, styled per `ui-ux`.
3. Verify through the running app as each affected role per
   `nextnode-definition-of-done`.
