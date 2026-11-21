# NextNode backlog: Phase 2 (Prototype Refinement)

Created 17 Nov 2026. **Due 23 Nov 2026; target 22 Nov.**
Rules and scope changes: `decisions/phase-2-product-decisions.md`.
Phase 1 backlog (still the reference for working flows): `backlog.md`.
Sources: Phase 2 brief, Stakeholder Meeting 1 (questions Q1–Q5 and the team
reflections), the Team Lead's decisions of 16–17 Nov 2026.

**Phase 2 builds screens and navigation.** Every item is a prototype unless it
says otherwise: reachable from the navigation, uses typed sample data, and
shows the "under construction" toast for actions that are not built yet. The
"Backend note" says what the real version needs. Backend work is allowed but
UI comes first.

Owners come from each member's reflection in the stakeholder meeting file;
the Team Lead assigned the rest (17 Nov 2026).

## GitHub issues (created 17 Nov 2026)

Milestone "Phase 2: Prototype Refinement" (due 22 Nov), label `phase-2`.
Owners confirmed by the Team Lead on 17 Nov 2026.

| Backlog | Issue | Owner |
| --- | --- | --- |
| NN-31 | [#87](https://github.com/NextNode-Devs/NextNode/issues/87) | `shar-hylton` |
| NN-32 | [#88](https://github.com/NextNode-Devs/NextNode/issues/88) | `Kaushalya-123` |
| NN-19 | [#89](https://github.com/NextNode-Devs/NextNode/issues/89) | `Kaushalya-123` |
| NN-26 | [#90](https://github.com/NextNode-Devs/NextNode/issues/90) | `Kaushalya-123` |
| NN-33 | [#91](https://github.com/NextNode-Devs/NextNode/issues/91) | `Kaushalya-123`, `Hardik33` |
| NN-15b | [#92](https://github.com/NextNode-Devs/NextNode/issues/92) | `Isabella-Enriquez` |
| NN-41 | [#93](https://github.com/NextNode-Devs/NextNode/issues/93) | `Isabella-Enriquez` |
| NN-16a | [#94](https://github.com/NextNode-Devs/NextNode/issues/94) | `AliyaaAli` |
| NN-16b | [#95](https://github.com/NextNode-Devs/NextNode/issues/95) | `KaiNabea` |
| NN-37 | [#96](https://github.com/NextNode-Devs/NextNode/issues/96) | `shar-hylton` |
| NN-17 | [#97](https://github.com/NextNode-Devs/NextNode/issues/97) | `KaiNabea` |
| NN-35 | [#98](https://github.com/NextNode-Devs/NextNode/issues/98) | `KaiNabea` |
| NN-36 | [#99](https://github.com/NextNode-Devs/NextNode/issues/99) | `KaiNabea` |
| NN-38 | [#100](https://github.com/NextNode-Devs/NextNode/issues/100) | `Hardik33`, `AliyaaAli` |
| NN-39 | [#101](https://github.com/NextNode-Devs/NextNode/issues/101) | `jayparmarsectionA` |
| NN-34 | [#102](https://github.com/NextNode-Devs/NextNode/issues/102) | `jayparmarsectionA` |
| NN-40 | [#103](https://github.com/NextNode-Devs/NextNode/issues/103) | `AliyaaAli` |
| NN-42 | [#104](https://github.com/NextNode-Devs/NextNode/issues/104) | `shar-hylton` |

## Schedule

| Dates | Work |
| --- | --- |
| 17–18 Nov | NN-31 prototype kit merged first (everyone else needs it) |
| 18–21 Nov | Feature screens (P1 below) |
| 21–22 Nov | Cross-testing and refinement; Phase 1 e2e must stay green |
| 22 Nov | Phase 2 document and zip; submit (latest 23 Nov) |

## P0: Shared prototype kit

**NN-31 · Prototype kit**. Owner: `shar-hylton` (Tavoiri). *Prototype
complete 17 Nov 2026.*
- Motion toast: desktop drops to the middle of the screen, phones and tablets
  top centre (`shared/ui/organisms/toaster.tsx`, mounted in the app providers)
- `toast()` and `underConstruction()` (`shared/lib/toast.ts`)
- `PrototypeBadge` ("Prototype" / "Planned") and `PrototypeNotice`
  (`shared/ui/molecules`)
- `MotionDialog`, a modal over a dimmed backdrop (`shared/ui/organisms`)
- Contact support button in the app header (`features/contact-support`)
- the `sample.ts` convention; `motion` 14.9.0 pinned

Acceptance: used by one screen; unit tests for the toast and modal
(keyboard, Esc, focus return); works at 375 px.

## P1: Feature screens

**NN-32 · Unified dashboard v2**. Kaushalya (`Kaushalya-123`). Trace: Q3.
- every project with its role badge (Team Lead / Assistant Lead / Developer / Client)
- role filter; "needs attention" list
- tabs: team chats, direct and hiring messages, applications, each with an unread count
- latest update per project (from NN-15b)

Backend note: the dashboard lists and per-project role exist. "Needs
attention" and the latest update need new read models.

**NN-19 · Notification bell**. Kaushalya. Trace: Q2, Q3.
- bell with a count and a dropdown list
- new notifications arrive as toasts (NN-31)
- notification settings page (with Jay)

Backend note: a Notification model, pushed over the existing WebSocket, plus
email through the provider.

**NN-26 · Time-limited invitation links**. Kaushalya.
- "Copy invite link" with an expiry shown
- expired-link and used-link screens

Backend note: a signed, single-use token with an expiry, checked again when
the link is accepted.

**NN-33 · Developer matching**. Kaushalya (Hire Devs filters and cards),
Hardik (`Hardik33`) (suggested developers panel). Trace: Q4.
- rule-based match score with its reason on each card
- the suggested panel always says why someone fits; the Lead chooses
- the filters (skills, availability, time zone, new talent) are Isabella's
  shared component from NN-41, reused here

Backend note: score computed on the server from the project's tech stack and
the developer's skills and availability. AI matching is a future iteration.

**NN-15b · Workspace extras**. Isabella (`Isabella-Enriquez`). Trace: Q3, Q5.
- project workspace tabs: chat, documents, video links (third-party meeting
  URL only), updates feed
- members-only access state

Backend note: VideoLink and ProjectUpdate models; access follows team
membership. Shapes the prototype expects (`entities/video-link`,
`entities/project-update`): a VideoLink is either one meeting (`starts_at`)
or weekly (`days` + `time`); a ProjectUpdate records the milestone in
progress when it was posted (`milestone_sequence`, null before work starts)
so the feed can group by milestone. The client and the Team Lead add
(and later remove) meetings (Team Lead decision, 20 Nov); the tab is
called "Meetings". Chat stays the Phase 1 team
conversation, which the client is not part of.

**NN-41 · Confidential briefs and search filters**. Isabella. Trace: Q4, Q5.
- "Confidential" toggle on the brief, which keeps the project out of portfolios
- "To be defined" legal panel (code ownership, confidentiality)
- **owns the shared developer filter component** (skills, availability,
  time zone, new talent), used by the directory search and reused by
  Kaushalya in Hire Devs. Isabella depends only on NN-31.

Backend note: a `confidential` flag on Project (set from the brief form's
switch, shown on the project page), honoured by NN-17's portfolio update.
`GET /api/developers/` filters on `tz` (an IANA zone) and `new_talent=true`,
using NN-34's profile fields; until then the directory narrows the loaded page
with sample values. Legal terms stay "To be defined".

**NN-16a · Offer with milestones**. Aliya (`AliyaaAli`). Trace: Q1.
- prototype section on the offer: milestones, each with an amount and due date
- deposit % term (20 % default; higher if agreed)
- the role being accepted is shown
- at least 3 milestones per offer
- the client accepts all milestones together and **picks milestone 1 or 2**
  as the one whose approval releases the deposit, with a tooltip saying the
  deposit is held and refundable (minus Stripe's processing fee) until then.
  Do not mention "proof of work" in the UI.
- the working Phase 1 offer form stays as is

Backend note: Milestone rows on the offer version (at least 3); amounts add
up to the total; a deposit % field; the deposit computed from it; the
release milestone (1 or 2) stored on the acceptance.

**NN-16b · Milestone delivery and review**. Kai (`KaiNabea`). Trace: Q1.
- Lead submits milestone work
- client approves or requests a revision (loop)
- milestone states `Pending Deposit → In Progress → Under Review → Completed`

Backend note: milestone transitions as domain methods, review history.

**NN-37 · Payments: planned deposit holding, receipts, cancel and refund**.
Tavoiri (Team Lead; all Stripe work). Trace: Q1, Q5.
- payment schedule labelled "Planned": 20 % deposit at the start, held until
  the client approves the milestone they chose (1 or 2), then released to
  the team; the final payment when the client approves the finished project
- a receipt for every payment
- cancel and refund while the deposit is held: the deposit back **minus
  Stripe's processing fee**
- fees panel (no NextNode fee; the refund fee is Stripe's processing fee)
- built: `/projects/[id]/payments` (client: totals, schedule, milestones,
  receipts, cancel and refund; Team Lead and members: totals and schedule),
  linked from the project page

Backend note: holding the deposit and releasing it to the team needs Stripe
Connect (separate charges and transfers, KYC); refunds read Stripe's fee from
the charge's balance transaction and refund the rest. A Team Lead decision;
not built in Phase 2. The live deposit is unchanged.

**NN-17 · Final approval, archive, portfolio update**. Kai.
- final approval screen
- archived project view, read-only, conversations greyed
- "Shipped projects" on the portfolio, without confidential projects
- code ownership "to be defined"

Backend note: FinalPayment, project `Completed → Archived`, team `Archived`,
portfolio entries.

**NN-35 · Ratings and references**. Kai. Trace: Q4.
- rating form after completion: the client rates the Lead and the team; the
  Lead rates each member
- hover, focus or tap on a rating opens a card with Motion-animated bars for
  the client rating and the Team Lead rating, each with its count; "New, no
  ratings yet" when empty
- "Team Lead reference" on a member's profile

Backend note: a Rating model, one per rater per ratee per project, only after
`Completed`; averages and counts per rater type.

**NN-36 · Junior and new-developer spots**. Kai. Trace: Q4.
- the Lead marks some open spots as junior
- the new-talent badge and filter link to NN-33 and NN-34

Backend note: spot type on the team. Team size is still 5–7 including the Lead.

**NN-38 · Lead and member replacement (client projects)**. Hardik (flow),
Aliya (re-sign screen and the access-lost state). Trace: Q2.
- leave or remove a member; the Lead picks a replacement
- "Lead unresponsive" banner after 3 days
- the team proposes a new Lead → client approves → the new Lead signs the
  current offer
- the "You no longer have access to this project" screen

Backend note: membership `Left` / `Removed` states; roster changes while
`Active`; a co-signature on the offer; removing someone from conversations;
an inactivity job.

**NN-39 · Assistant Lead and inactivity (developer projects)**. Jay
(`jayparmarsectionA`) (shared authorization rules). Trace: Team
Lead, 17 Nov.
- the Lead chooses an Assistant Lead
- the Assistant Lead's permissions shown on the roster (cannot remove the Lead)
- after the Lead has been inactive for 30 days: "Is this project still
  active?" request to members; hidden from the open-projects feed and the
  suggestion pool while waiting; a confirming member can be elected
  Assistant Lead
- no answer in 7 days: the project is marked closed (and leaves the feed)

Backend note: an `AssistantLead` role on membership; permission checks in the
shared policy; a daily scheduled inactivity check; the feed and suggestion
queries exclude flagged projects.

**NN-34 · Developer profile growth**. Jay. Trace: Q4.
- time-zone field, new-talent flag, profile completeness bar
- certificate upload (shown "as provided", never "verified")
- "Import from GitHub" entry point
- onboarding and upload screens work well on a phone

Backend note: profile fields and a migration (a good first real backend
slice); certificates through `FileStorage` (PDF, PNG, JPG); GitHub sign-in
through Clerk.

**NN-40 · Disputes and support**. Aliya. Trace: Q5.
- "Raise an issue with your Team Lead" entry in the workspace
- "Contact support" button opening the NN-31 modal

Backend note: none for Phase 2.

## P2: Submission (Phase 2 brief)

**NN-42 · Phase 2 document and zip**. Tavoiri.
`Prototype_Document_Phase2_Group1.docx`: updated setup (new prerequisites,
installation steps, configuration such as `motion` and any new environment
variables), task distribution (who built each added feature; who tested and
refined each part), short notes on the enhancements.
`Project_Prototype_Phase2_Group1.zip` (no `.env`, `node_modules`, `.venv` or
build output).

## Testing and refinement (cross-testing pairs, )

Each owner tests their own screens before opening a PR, and Tavoiri reviews
before merging. A second member then tests each area at 375, 768 and 1280 px,
with the keyboard only:

| Area | Tester |
| --- | --- |
| Dashboard, bell, links, matching (Kaushalya) | Isabella |
| Workspace, confidential, search (Isabella) | Kaushalya |
| Offer milestones, replacement re-sign, disputes (Aliya) | Kai |
| Delivery, final approval, ratings, junior spots (Kai) | Aliya |
| Replacement flow, suggested panel (Hardik) | Jay |
| Profile growth, Assistant Lead (Jay) | Hardik |
| Prototype kit, payments (Tavoiri) | everyone, through their own screens |
