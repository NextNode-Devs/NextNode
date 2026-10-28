# Phase 1 scope review

Prepared 27 Oct 2026; revised the same day after the team lead's review, and
again (fourth review) with the Team Lead's confirmed decisions: deadline,
budget minimum, deposit rule, upload limits and access, team states, one team
per project, workspace chat participants, and a separate Stripe issue (#7).
**Phase 1 deadline: 1 November 2026.**
**The direction is approved: Phase 1 ends at project initiation.** The Phase 1
column records that decision. The Source column records what the documents
require, and that does not change: a deferred item is still a requirement and
stays in `backlog.md` for a later phase. Items that still need a group
decision are listed at the end.

Sources: Proposal (MVP, FR1–8, NFR1–5, Deliverables, Technology), Use Case
Diagram (UC), Class Diagram (CD), Activity Diagrams (AD), Phase 1 brief (P1).
Complexity is relative: **S** ≈ a few days for one person, **M** ≈ one to two
weeks, **L** ≈ more than two weeks or several integration risks.

The Phase 1 brief itself names no features. It asks for "the essential
functionalities that form the foundational features … aligned with the project
proposal and the UML diagrams", plus setup instructions, a progress report and
a task distribution sheet. The proposal defines the MVP's purpose as "a
functional end-to-end loop validating **team formation, client discovery, and
project initiation**". The approved cut follows that sentence.

## Feature comparison

| # | Feature | Source | Phase 1 | User value | Depends on | Cx | Issue | If deferred |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Clerk sign-up/sign-in (email + Google), role onboarding | FR1; UC Sign In/Register, Complete Onboarding «extend»; AD role selection, Clerk login | **In** (approved stack) | Nobody can do anything without it | Clerk dev instance | M | #1 | Nothing else works |
| 2 | Role dashboard (things needing my action) | UC View Dashboard | **In**, thin | One place to find applications, invitations, conversations | 1 | S | #1 shell + each issue | Users must hunt by URL; substitutes for notifications |
| 3 | Developer portfolio (headline, bio, skills, GitHub/demo/repo URLs, resume URL) | FR2; UC Update Portfolio; CD Developer, Portfolio | **In** | Developers are chosen on it | 1 | M | #2 | Clients and Leads cannot judge candidates |
| 4 | Client-facing developer directory (browse, filter, open portfolio) | FR2; MVP "client-facing … directory"; UC View Dev Portfolios; AD "request from portfolio page" | **In** (approved) | Client discovery; entry point for invitations | 3 | M | #2 | Client invitations (#8) have no entry point |
| 5 | "Available for work" flag + filter | CD `Developer.isAvailable` | **In** | Clients skip unavailable people | 3 | S | #2 | Minor |
| 6 | URLs accepted as provided, never labelled "verified" | FR2 "verified GitHub links"; CD `verifyRepoLink`; decision 8 | **In** (approved) | Honest profiles | 3 | S | #2 | — |
| 7 | Client project briefs (publish, edit while Posted) | FR4; UC Create Job; AD post brief; CD Project | **In** — proposed budget (negotiable), CAD, minimum CAD 1,500 enforced by the backend | Starts Workflow A | 1 | M | #3 | No client projects |
| 8 | Developer-created project ideas (creator = Lead, no payments) | UC Propose Projects, Publish Project Ideas; AD dev-created branch | **In** (approved) | Developers build portfolio projects | 1 | S | #3 | Half the activity diagram missing |
| 9 | Project search and detail | UC Search & View Projects | **In** | How developers find work | 7, 8 | M | #3 | Applying impossible |
| 10 | Requirement document upload (PDF/DOCX) with private, expiring links | FR4; MVP "project request workflow with document uploads"; CD `uploadRequirementDoc`, `requirementDocs`; NFR2 | **In (basic)** — local private storage; limits need confirmation | Clients share real requirements | 7 | M | #3 | An explicit MVP requirement unmet; briefs are text only |
| 11 | Document previews, delete | MVP "document previews"; CD `previewDocument`, `deleteDocument` | **Defer** | Convenience | 10 | M | — | Download instead of inline preview |
| 12 | Apply to lead + client invites to lead | UC Apply To Project, Hire Team Lead; AD Hire Team Lead | **In** (approved) | Client gets a Lead | 4, 7, 13 | M | #4 | No client project can proceed |
| 13 | WebSocket hiring conversations (auth, membership, persistence, decisions in chat, close-others) | AD chat steps; FR5; NFR1; Tech "WebSockets" | **In** (approved) | The diagrams' hiring mechanism, real time | 1; Redis (approved) | L | #4 (+ socket auth in #1) | Hiring cannot follow the diagrams |
| 14 | Hire Devs: set size, open spots, apply to join, Lead invites, invitee accepts | FR3; UC Set Team Size, Select Team Members; AD Hire Devs | **In** (approved) | Team formation | 8 or 12, 13 | M | #5 | No teams |
| 15 | Roster + 5–7 incl. Lead + team profile (Lead and members' portfolios) | FR3 "5–7 members", FR2 "team profiles show Lead and members' portfolios"; decision | **In** (approved) | Client sees who they are buying | 14, 3 | S | #5 | — |
| 16 | Close project proposal (stop recruiting once full) | UC Close Project Proposal; workflow description | **In** | Clear end of recruitment | 14 | S | #6 | Recruitment never formally ends |
| 17 | Offer + basic agreement acceptance (client-funded) | UC Sign Agreement; CD `sendOfferToClient`, `reviewOffer`, `signAgreement`, status `OfferSent`; AD "Finalize estimate & submit timeline"; decision 7 | **In** (approved, basic) | Both sides confirm scope, timeline and price before money moves | 15 | S–M | #6 | Deposit has nothing to attach to |
| 18 | Stripe Checkout deposit (test mode), webhook-confirmed | FR6; UC Make Initial Deposit «include» Process Payment; AD "Authorize upfront deposit"; CD Payment, StripeGateway; NFR3 | **In** — confirmed: 20 % of the final accepted offer, CAD; minimum project budget CAD 1,500 (backend-enforced) | Demonstrates the client funding gate | 17; Stripe test account | M–L | #7 (Team Lead) | Client-funded projects cannot start in the prototype |
| 19 | Start gate + roster lock | AD "Lock squad roster & enable dev chat access", "Finalize timeline" (dev-created) | **In** | Project initiation — the MVP's stated goal | 16–18 | S | #6 (gate) + #7 (deposit condition) | MVP loop incomplete |
| 20 | Minimal team workspace chat enabled at roster lock (team members, reusing #13) | AD "Enable dev chat access", "Code features & workspace team chat"; FR5 (workspace) | **In (minimal)** — team members only; client excluded (confirmed) | The gate's "enable chat" step does something real | 13, 19 | S; #13 must be generic | #6 | Gate step exists in name only until Phase 2 |
| 21 | Workspace extras: presence, video-meeting link, project updates | FR5 presence + video buttons; UC Share Project Updates, Client and Team Lead Collab | **Defer** | Collaboration comfort | 20 | M | — | Teams coordinate in the basic chat |
| 22 | Milestones, work submission, revision requests, scope adjustment | FR6 milestone states; FR7; UC Review Project; AD review loop; CD `addMilestone`, `requestScopeChange` | **Defer (Phase 2)** | Delivery management | 19 | M–L | — | Delivery phase not demoed in Phase 1 |
| 23 | Final approval, final payment, completion, archive, portfolio "shipped" update | FR6, FR7; UC Approve Product, Make Final Payment; AD wrap-up; CD `saveShippedProject` | **Defer (Phase 2)** | Closes the loop | 22, 18 | M | — | MVP loop ends at initiation in Phase 1 |
| 24 | Dev-created project completion by Lead | AD "Team Lead is satisfied …" | **Defer** | Closes dev loop | 19 | S | — | Same as 23 |
| 25 | Notifications (bell + email) | FR8 | **Defer** (approved unless required) | Faster responses | 1 | M | — | See analysis below: no in-scope workflow breaks |
| 26 | Soft deletion / audit trail | FR7 | **In** as a rule (no hard-delete paths on Phase 1 records) | Records survive | — | S | all | — |
| 27 | Immutable payment record / receipt | FR6 "immutable digital transaction receipts" | **In** for the deposit record (Stripe's test receipt + stored, never-edited Payment) | Trust in payment state | 18 | S | #7 | — |
| 28 | Time-limited invitation links/tokens | FR3 | **Defer** (in-app invitations cover the diagrams) | Invite people off-platform | 14 | M | — | Invitations only to registered developers |
| 29 | Pre-formed "squad directory" (choose a squad) | MVP "client-facing squad directory"; FR3 "before choosing a squad" | **Not built** — no pre-formed squad marketplace without a confirmed source requirement; discovery is the developer directory + project-specific hiring | — | — | — | — | Revisit only if the group confirms a requirement |
| 30 | CI, branch flow, protections | Proposal Technology; NFR4 | **In** (admin action) | Keeps `develop` working | first push | S | backlog NN-02 | Regressions reach `develop` |
| 31 | ER diagram of the schema | Proposal Deliverables | **In (P2)** | Required deliverable | models from #1–#6 | S | backlog | Deliverable missing |
| 32 | AWS hosting, daily backups, HTTPS | Proposal Deliverables, NFR2, NFR4 | **Defer** (Phase 1 is submitted as a runnable zip) | Public demo | all | M | — | Demo runs locally |
| 33 | Phase 1 submission documents | P1 brief | **In** | Graded deliverable | all | S | backlog | Mark deductions per the brief |

## Notifications — is any in-scope workflow blocked without them?

No. Every Phase 1 decision point is reachable without a notification:

| Workflow step | How the user learns of it without notifications |
| --- | --- |
| Developer applies to lead / join | Client or Lead sees it on their dashboard and, if online, live in the conversation list over the WebSocket |
| Client or Lead invites a developer | Developer's dashboard "Invitations" and live conversation list |
| New chat message | Delivered live when online; unread counts on the dashboard otherwise |
| Hired / accepted / team full / conversation closed | Broadcast in the conversation; dashboard state |
| Deposit confirmed | Project page start-gate status |

The cost of deferring is latency (an offline user only sees it on next visit),
not broken behaviour. Decision: FR8 stays deferred.

## Uploads — what the sources actually require

| Source | Exact wording / element | Phase 1 |
| --- | --- | --- |
| Proposal FR4 | "Clients must be able to upload requirement documentation (PDF, DOCX) directly into the project workspace." | In (basic) |
| Proposal MVP | "a project request workflow with document uploads", "workspace featuring … document previews" | Upload In; previews Defer |
| Proposal NFR2 | "Client project files … must not be public … Only members of that specific project team can view or download them, and links expire automatically after 15 minutes." | In with any upload |
| Proposal Deliverables | "REST API handling … file uploads" | In with any upload |
| Proposal scope | Teams can "share documents" | Defer (team document sharing beyond client requirements) |
| CD | `Client.uploadRequirementDoc(project, file)`; `Project.requirementDocs`, `uploadDocument`, `previewDocument`, `deleteDocument` | upload/list/download In; preview/delete Defer |
| CD | `Portfolio.resumeUrl : String` | A URL field, **not** an upload |
| Use case and activity diagrams | No upload use case or step | — |
| Phase 1 brief | No upload requirement | — |

Not specified anywhere. Resolved in the third and fourth reviews:

| Gap | Phase 1 plan | Status |
| --- | --- | --- |
| Storage provider | `FileStorage` port; local private storage first (git-ignored, never served directly) | Decided |
| Validation | Server checks extension **and** file signature (PDF/DOCX), size, count and authorization on every upload and link request | Decided |
| Maximum file size | 10 MB per file (`UPLOAD_MAX_BYTES`) | **Confirmed** by the Team Lead (a team decision, not a source value) |
| Files per project | 10 (`UPLOAD_MAX_FILES_PER_PROJECT`) | **Confirmed** by the Team Lead |
| Who may read before a team exists | NFR2 read literally: the owning client, the Team Lead and approved members only. Applicants and invited candidates may read the brief's text, not its documents | **Confirmed** |

## Agreement — what the sources say, and what is missing

| Source | Element |
| --- | --- |
| UC | Team Lead: "Sign Agreement", "Close Project Proposal" |
| Workflow description | "Once the team is full, the Team Lead closes the project proposal and signs the agreement. The Client then makes the initial deposit" |
| CD | `TeamLead.sendOfferToClient(project)`, `TeamLead.signAgreement(project)`, `Client.reviewOffer(offer)`, `Project.sendOffer(team)`, `Project.assignTeam(team)`, status `Posted → OfferSent → Assigned → InProgress` |
| AD | Team Lead "Finalize Estimate & Submit Timeline to Client" → Client "Authorize Upfront Deposit" |

Proposed basic step (traced to the above): the Team Lead sends an **offer**
(estimate, timeline) and signs → project `OfferSent` → the client reviews and
**accepts** → project `Assigned` → deposit. Each acceptance records who, when
and the exact offer version accepted. The UI states plainly that this is an
in-app acknowledgement for a student prototype, **not a legal contract**.

Each signature and acceptance records the **offer (agreement) version, the
user and the timestamp**. Nothing claims the agreement has been legally
reviewed.

Budget and deposit (confirmed by the Team Lead, 27 Oct 2026): the budget on a
client's listing is a **proposal** that the client and Team Lead may
negotiate; the offer the client finally accepts sets the project total. The
**minimum project budget is CAD 1,500**, validated by the backend on the
brief, on each offer and at checkout. The **deposit is 20 % of the final
accepted offer**, in CAD, payable at project initiation, computed on the
server in whole cents (`DEPOSIT_PERCENT` stays a setting because the rule may
change later). Stripe work and payment verification are owned by the Team
Lead in #7. Per-location currency is a possible later option, not Phase 1.

Terms the sources still never define (no text will be invented): payment
schedule beyond the deposit, IP ownership, cancellation and refund rules,
confidentiality, and the agreement wording itself.

## Effort by issue

| Issue | Before | After this revision | Notes |
| --- | --- | --- | --- |
| #1 Auth & onboarding | M | M | + Channels, Redis, WebSocket auth handshake and shared authorization (moved from #4) |
| #2 Portfolios & directory | M | M | + availability flag; invite-to-lead entry point on portfolio |
| #3 Projects | M | M–L | + basic private requirement uploads |
| #4 Hiring conversations + Hire Lead | M–L | L | Heaviest issue even with socket auth in #1 |
| #5 Hire Devs & roster | M | M | + team profile with portfolios |
| #6 Start gate | M–L | M | Close proposal, offer + agreement acceptance, gate status, developer-project start, minimal workspace chat (Stripe moved to #7) |
| #7 Stripe deposit (Team Lead) | — | M | Test-mode setup, Checkout, deposit calculation, minimum-budget check, verified idempotent webhook, start-gate enforcement, payment tests |

## Phase 1 cut (direction approved 27 Oct 2026)

**In:** features 1–10, 12–20, 26, 27, 30, 31, 33.
**Defer (still requirements, kept in the backlog):** 11, 21–25, 28, 32.
**Not built:** 29 (pre-formed squad marketplace) unless a source requirement
is confirmed.

Why: it delivers the proposal's MVP purpose (team formation, client
discovery, project initiation) for both kinds of project and keeps delivery
and close-out (features 22–24) as one later increment that reuses Phase 1's
payment and conversation code. Restructuring: WebSocket connection
authentication and shared authorization moved to #1, and the Stripe deposit
moved out of #6 into #7, owned by the Team Lead.

## Confirmed by the Team Lead (27 Oct 2026, fourth review)

Deadline 1 Nov 2026; minimum budget CAD 1,500; listing budget is a negotiable
proposal; deposit 20 % of the final accepted offer, at initiation; Stripe
owned by the Team Lead (#7); private documents closed to applicants and
invited candidates, 15-minute links for the team; 10 MB / 10 files; `Locked`
= roster finalised, awaiting the start gate; `Active` = start conditions met,
work begun; one team per project; workspace chat for team members only.

## Still open

| # | Item | Blocks |
| --- | --- | --- |
| 1 | Add the five source PDFs to `docs/spec/`; until then traces, the deadline and the confirmed decisions cannot be checked against the originals in the repository | NN-23; verifying traces |
| 2 | Clerk development keys as GitHub environment secrets for authenticated E2E in CI | CI E2E once #1 lands |
| 3 | CI end-to-end deposit run: a Stripe **test** secret key as a GitHub environment secret, or a CI-only fake `PaymentGateway` (Team Lead's decision in #7) | #7 E2E in CI |
| 4 | Per-location currency: wanted later? Location source and currency list | Nothing in Phase 1 |

Details: `decisions/phase-1-product-decisions.md`.
