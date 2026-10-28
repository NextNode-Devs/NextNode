# NextNode product backlog

Revised 27 Oct 2026 (fourth review: the Team Lead's confirmed decisions).
Sources: project proposal (FR/NFR), use case diagram (UC), class diagram
(CD), activity diagrams (AD), Phase 1 brief, and
`decisions/phase-1-product-decisions.md`. The source PDFs are not yet in
`docs/spec/` (NN-23).

**Phase 1 deadline: 1 November 2026** (confirmed by the Team Lead).

**The Phase 1 direction is approved: Phase 1 ends at project initiation.**
Comparison and reasons: `phase-1-scope-review.md`. Deferred items remain
source requirements; they are kept here, not deleted.

Status key:
- **In** — Phase 1, approved.
- **Deferred** — a source requirement scheduled after Phase 1.
- **Not built** — no confirmed source requirement.
- **Done** — finished in the setup stage (in the initial commit).

---

## P0 — Required foundation

**NN-01 · Development foundation** — *Done*
Frontend/backend skeletons, env validation, `/api/health/`, Clerk token
verification, JSON errors, CORS, all checks passing locally.

**NN-02 · Activate CI and branch protection** — *CI done (initial commit); branch protection: admin action*
Story: every PR is checked; promotion follows feature → develop → staging →
main. Acceptance: workflows from `proposals/ci.md` (with the Redis service
added by #1) green on a PR; `develop` and `staging` exist; protections set.
Remaining: branch protection on `develop`/`staging`/`main`; Clerk keys as GitHub
environment secrets for authenticated E2E; for #7's E2E deposit run, a Stripe
test secret key as an environment secret or a CI-only gateway fake (the Team
Lead's decision in #7).
Trace: proposal Technology; NFR4.

**NN-03 · Clerk sign-in/sign-up (email + Google)** — *In* · #1
Acceptance: Clerk pages, `proxy.ts` redirect for protected routes, token sent
to Django, `/api/me/` works in the running app. Depends: NN-01, Clerk
development instance (created when #1 starts). Trace: FR1; UC Sign
In/Register; AD Clerk login.

**NN-04 · Accounts and role onboarding** — *In* · #1
One account per Clerk user; role Developer or Client chosen once; Team Lead
never a selectable role. Trace: UC Complete Onboarding «extend»; CD
User/Developer/Client.

**NN-24 · Authenticated WebSocket foundation + shared authorization** — *In* · #1
Channels on ASGI, Redis channel layer (docker-compose and CI), Origin check,
Clerk token in the first frame, re-auth, close codes, the shared
"can this account access this resource" policy used by REST and sockets.
Depends: NN-03. Trace: proposal Technology "WebSockets"; NFR1; FR5.

## P1 — Core MVP

**NN-14 · Role dashboards** — *In (thin)* · #1 shell, filled by each issue
Projects, applications, invitations, conversations with unread counts. Stands
in for notifications. Trace: UC View Dashboard.

**NN-05 · Developer portfolio** — *In* · #2
GitHub/repo/demo/resume **URLs accepted as provided, never labelled
verified**. Trace: FR2; UC Update Portfolio; CD Portfolio.

**NN-06 · Client-facing developer directory** — *In* · #2
Browse/search/filter portfolios; "Invite to lead" from a portfolio (owned by
#4). Trace: FR2; MVP directory; UC View Dev Portfolios; AD "request from
portfolio page".

**NN-25 · Availability flag** — *In* · #2. Trace: CD `Developer.isAvailable`.

**NN-07 · Client project briefs** — *In* · #3
The budget shown is the client's **proposed** budget in CAD (negotiable with
the Team Lead); **minimum CAD 1,500**, enforced by backend validation.
Trace: FR4; UC Create Job; CD Project.

**NN-08 · Developer-created project ideas** — *In* · #3
Creator becomes Lead; no offer/agreement/payment anywhere. Trace: UC Propose
Projects, Publish Project Ideas; AD dev-created branch.

**NN-09 · Search and view projects** — *In* · #3. Trace: UC Search & View Projects.

**NN-18 · Private requirement documents (PDF/DOCX)** — *In* · #3
`FileStorage` port, local private storage; server-side type (extension +
signature), size, count and access checks; links expire after 15 minutes.
Readers: owning client, Team Lead, approved members — **not applicants or
invited candidates**, who may read the brief. Limits (confirmed): 10 MB per
file, 10 files per project. Trace: FR4; MVP; NFR2; CD `uploadRequirementDoc`.

**NN-10 · WebSocket hiring conversations** — *In* · #4
Conversation per application/invitation; persisted before broadcast;
participants only; decisions inside the conversation; close-others; generic
enough for #5 and the workspace chat. Trace: AD chat steps; FR5; NFR1.

**NN-11 · Hire Lead (Workflow A)** — *In* · #4
Apply to lead + client invites from directory/portfolio; client hires one
Lead; others closed; project stays `Posted`. Trace: UC Apply To Project, Hire
Team Lead; AD page titled "Hire Devs".

**NN-12 · Hire Devs (Workflow B) and roster** — *In* · #5
Size 5–7 incl. Lead; apply to join (Lead accepts); Lead invites (invitee
accepts); atomic spots; close-others when full; team profile. Team `Open`
while recruiting. Trace: FR3; FR2; UC Set Team Size, Select Team Members; AD
page titled "Hire Lead".

**NN-13 · Project start gate (non-payment)** — *In* · #6 (shared allocation)
Close proposal (team `Locked`: roster finalised, awaiting the start gate) →
versioned offer in CAD signed by the Lead (`OfferSent`; total ≥ CAD 1,500,
backend-validated; negotiation by decline-with-reason and revised versions)
→ client accepts, recording offer version, user and time (`Assigned`) →
deposit (NN-30) → team `Active` (start conditions met, work begun), project
`InProgress`. Developer-created: close proposal → timeline →
`Active`/`InProgress`. No legal terms invented. Trace: UC Close Project
Proposal, Sign Agreement; CD `sendOfferToClient`, `reviewOffer`,
`signAgreement`; AD start gate.

**NN-30 · Stripe test-mode deposit** — *In* · #7, owned by the Team Lead
(`shar-hylton`)
Stripe test account and keys (environment variables / GitHub environment
secrets only), Checkout Session, deposit = **20 % of the final accepted offer
total, CAD**, payable at initiation, computed on the server; minimum budget
re-checked; webhook signature verified on the backend; duplicate events
ignored; only a confirmed deposit starts a client project; a browser redirect
never confirms payment; payment tests. Trace: UC Make Initial Deposit
«include» Process Payment; CD Payment, StripeGateway; AD "Authorize upfront
deposit"; FR6; NFR3.

**NN-15a · Minimal workspace chat at project start** — *In* · #6
One conversation for the team members when the team becomes `Active`,
reusing NN-10. The client is excluded (confirmed; AD "enable dev chat
access"). Trace: AD "Lock squad roster & enable dev chat access"; FR5.

**NN-15b · Workspace extras** (presence, video link, project updates) — *Deferred*
Trace: FR5; UC Share Project Updates, Client and Team Lead Collab.

**NN-16 · Milestones, work submission, revisions, scope adjustment** — *Deferred*
Trace: FR6–7; UC Review Project; AD review loop.

**NN-17 · Final approval, final payment, completion, archive, portfolio update** — *Deferred*
Trace: FR6–7; UC Approve Product, Make Final Payment; AD wrap-up.

**NN-18b · Document previews, deletion, team document sharing** — *Deferred*
Trace: MVP "document previews"; CD `previewDocument`, `deleteDocument`.

**NN-19 · Notifications (bell + email)** — *Deferred* — unless an in-scope
workflow turns out to need one. Trace: FR8.

**NN-26 · Time-limited invitation links** — *Deferred*. Trace: FR3.

**NN-29 · Pre-formed squad directory** — *Not built* — no confirmed source
requirement beyond the proposal's wording; discovery is NN-06 + Workflow A.
Trace: MVP "squad directory"; FR3.

## P2 — Supporting deliverables

**NN-20 · End-to-end coverage** — *In (shared)* — each issue's journeys plus
one client-project run to `InProgress` (Stripe test mode, signed test webhook
in CI).

**NN-21 · Accessibility and responsive verification** — *In (shared)*.

**NN-27 · ER diagram of the schema** — *In* — proposal Deliverables.

**NN-22 · Phase 1 submission documents** — *In (Phase 1 brief)* — prototype
zip, progress report with setup instructions, task distribution sheet;
written from actual work.

**NN-23 · Source documents in `docs/spec/` and diagram title fix** — *In* —
**blocker:** none of the five source PDFs is in the repository yet.

**NN-28 · AWS hosting, backups, HTTPS** — *Deferred* — Phase 1 is submitted as
a runnable zip.

## Decisions

Confirmed by the Team Lead (27 Oct 2026): deadline 1 Nov 2026; minimum budget
CAD 1,500; listing budget is a negotiable proposal; deposit 20 % of the final
accepted offer at initiation; Stripe owned by the Team Lead (#7); private
documents closed to applicants and invited candidates; 10 MB / 10 files;
`Locked`/`Active` definitions; one team per project; workspace chat for team
members only.

Still open: source PDFs into `docs/spec/` (NN-23); Clerk keys for CI; Stripe
test key or gateway fake for the CI deposit E2E (Team Lead, #7);
per-location currency for a later phase. Details:
`decisions/phase-1-product-decisions.md`.

## Out of scope

Escrow, fund custody, transfers, payment splitting, developer payouts; admin
role/console; link verification; billing reconciliation; analytics feeds;
co-op auditing portals; ratings/bidding; in-app video.

---

## GitHub issues (#7 assigned to `shar-hylton`; #1–#6 unassigned for shared allocation)

| Issue | Backlog items | Depends on | Size |
| --- | --- | --- | --- |
| [#1](https://github.com/NextNode-Devs/NextNode/issues/1) Clerk authentication, onboarding, dashboard shell, WebSocket auth foundation | NN-03, NN-04, NN-24, NN-14 shell | NN-01 | M |
| [#2](https://github.com/NextNode-Devs/NextNode/issues/2) Developer portfolios and client-facing directory | NN-05, NN-06, NN-25 | #1 | M |
| [#3](https://github.com/NextNode-Devs/NextNode/issues/3) Projects: client briefs, developer ideas, search, detail, private documents | NN-07, NN-08, NN-09, NN-18 | #1 | M–L |
| [#4](https://github.com/NextNode-Devs/NextNode/issues/4) WebSocket hiring conversations and Hire Lead | NN-10, NN-11 | #1, #2, #3 | L |
| [#5](https://github.com/NextNode-Devs/NextNode/issues/5) Hire Devs and team roster (5–7 incl. Lead) | NN-12 | #3, #4 | M |
| [#6](https://github.com/NextNode-Devs/NextNode/issues/6) Start gate: close proposal, offer, agreement acceptance, project start, workspace chat | NN-13, NN-15a | #5 | M |
| [#7](https://github.com/NextNode-Devs/NextNode/issues/7) Stripe test-mode deposit (assigned `shar-hylton`) | NN-30 | #6 for the accepted offer; setup and webhook can start now | M |

Critical path: #1 → #3 → #4 → #5 → #6 → #7 (final wiring), with #2 alongside
#3 and #7's Stripe setup, gateway and webhook built in parallel from the
start. Shared: NN-20, NN-21. Coordination tasks to delegate separately:
NN-02, NN-22, NN-23, NN-27.

**Schedule:** the 1 Nov 2026 deadline is five days after this revision, for
seven issues plus the NN-22 submission documents.
