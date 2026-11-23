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
attention" and the latest update need new read models. The prototype
(`widgets/dashboard-overview`, shapes in `entities/project/model/dashboard.ts`
and `entities/conversation/model/inbox.ts`) expects one `GET /api/dashboard/`
returning: each project with the viewer's role (`lead`, `assistant_lead`,
`member`, `client`; `my_role` has no Assistant Lead yet) and `has_access`
(false once they've left: send the title, status and role only, never its
updates or chat); attention
items (`kind`, project, role, text, action); and every conversation with its
`unread_count` and a `tab` (`team`, `messages`, `applications`). Clients get
no team chats. Direct messages are a new conversation kind.

**NN-19 · Notification bell**. Kaushalya. Trace: Q2, Q3.
- bell with a count and a dropdown list
- new notifications arrive as toasts (NN-31)
- notification settings page (with Jay)

Backend note: a Notification model, pushed over the existing WebSocket, plus
email through the provider. The prototype (`entities/notification`, the bell
in `features/notification-bell`, `/settings/notifications`) expects:
`GET /api/notifications/` (newest first, each with `category`, `title`,
`body`, `created_at`, `read`) and a way to mark them read; settings per
category (`hiring`, `team`, `projects`, `payments`, `messages`), each with
`in_app` and `email` on or off, through `GET/PUT /api/notifications/settings/`,
applied on the server before a push or an email is sent. Alerts outside the
tab (browser notifications) are planned only.

**NN-26 · Time-limited invitation links**. Kaushalya.
- "Copy invite link" with an expiry shown
- expired-link and used-link screens

Backend note: a signed, single-use token with an expiry, checked again when
the link is accepted. The prototype (`entities/invite-link`, the "Invite by
link" card on the project page, `/invite/[token]`) expects: the Team Lead picks
the expiry (24 hours, 3 days or 7 days); one active link per team, where a new
link or Revoke stops the old one; `GET /api/projects/{id}/invite-links/` (Lead
only) and `GET /api/invite-links/{token}/`, each link carrying a server-worked
`status` (`active`, `expired`, `used`) and `expires_at`, `used_at`,
`used_by_name`. Accepting re-checks that the viewer is a developer not already
on the project and that the team is open with a spot free.

**NN-33 · Developer matching**. Kaushalya (Hire Devs filters and cards),
Hardik (`Hardik33`) (suggested developers panel). Trace: Q4.
- rule-based match score with its reason on each card
- the suggested panel always says why someone fits; the Lead chooses
- the filters (skills, availability, time zone, new talent) are Isabella's
  shared component from NN-41, reused here

Backend note: score computed on the server from the project's tech stack and
the developer's skills and availability. AI matching is a future iteration.
*Prototype 22–23 Nov 2026: Hire Devs at `/projects/[id]/hire-devs` (Kaushalya:
cards, match reason, filters) with "Suggested for your team" on top (Hardik:
`widgets/suggested-developers`). One rule for both: `scoreMatch` in
`entities/developer/model/match.ts`, run in the browser over sample developers.*

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
*Prototype complete 23 Nov 2026.*
- final approval screen
- archived project view, read-only, conversations greyed
- "Shipped projects" on the portfolio, without confidential projects
- code ownership "to be defined"
- built: a "Finishing the project" card on client projects (client, Team Lead,
  members) opens `/projects/[id]/final-approval` (the client approves and pays
  the final payment, labelled "Planned"; the Lead and members see where it
  stands) and `/projects/[id]/archived` (read-only; each viewer sees only the
  conversations they were in, greyed with the composer closed). "Shipped
  projects" is a prototype section on `/developers/[id]`; its owner is told
  how many confidential projects are kept off. Confidential is a sample flag
  until NN-41 adds it to Project

Backend note: FinalPayment, project `Completed → Archived`, team `Archived`,
portfolio entries. The prototype assumes `InProgress → Completed` once every
milestone is approved, and that final approval charges the final payment and
archives the project and team in one step (`archived_at` = approval time).
Portfolio entries are written for every team member then, never for a
confidential project. Planned shapes: `ProjectClosing`
(`entities/project/model/closing.ts`) and `ShippedProject`
(`entities/developer/model/shipped-project.ts`).

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
*Flow prototype 21 Nov 2026 (Hardik): the Team tab on client projects,
`/projects/[id]/team` (`widgets/team-changes`, sample data in
`entities/team/model/replacement-sample.ts`).*
*Re-sign and access-lost prototype 23 Nov 2026 (Aliya): the new Lead signs the
current offer at `/projects/[id]/team/sign-offer` (`widgets/lead-resign`,
`features/sign-offer-as-lead`), and "You no longer have access to this
project" at `/projects/[id]/no-access` (`widgets/access-removed`), linked from
the Team tab and the dashboard's no-access rows. Sample data in
`entities/team/model/lead-resign-sample.ts`.*
- leave or remove a member; the Lead picks a replacement
- "Lead unresponsive" banner after 3 days
- the team proposes a new Lead → client approves → the new Lead signs the
  current offer
- the "You no longer have access to this project" screen

Backend note: membership `Left` / `Removed` states; roster changes while
`Active`; a co-signature on the offer; removing someone from conversations;
an inactivity job. The re-sign screen expects the co-signature on the
accepted version (no new version, the client doesn't accept again); the
access-lost screen expects `FORBIDDEN` on the project to carry the reason
(left, removed, replaced as Lead) and when.

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

*Built with a real backend (21 Nov 2026):* the `assistant_lead` membership
role; `project_team` read/steward rules in the shared policy; activity is the
Team Lead's messages in the project's workspace chat (milestones will count
once built), so only started projects are checked; `manage.py
check_project_activity` is the daily job (`--every` keeps it running,
`--as-of` simulates a date); the feed excludes projects waiting for an answer;
the first member to confirm becomes Assistant Lead; no answer in 7 days sets
the new `Closed` status. The Lead or Assistant Lead may also close the project.
Planned, shown as such on the screen: the Assistant Lead adding or removing
members, editing details and marking the project complete. There is no project
suggestion pool yet, so only the feed is filtered.

**NN-34 · Developer profile growth**. Jay. Trace: Q4.
- time-zone field, new-talent flag, profile completeness bar (new talent
  decided 21 Nov 2026: automatic for 15 days after the account is created,
  served by the directory API; see NN-39). *Built for real (21 Nov 2026):*
  PDF certificate upload replacing the resume link, with a preview on the
  portfolio, and the completeness bar on the edit page (see the Phase 2
  decisions of 21 Nov).
- certificate upload (shown "as provided", never "verified")
- "Import from GitHub" entry point. *Prototype (22 Nov 2026):* a marked
  entry in the Projects section of the portfolio form that shows the
  under-construction toast; projects are still added by hand.
- onboarding and upload screens work well on a phone (checked in e2e at
  375 / 768 / 1280: onboarding in `auth.spec.ts`, the edit page and a
  certificate upload in `portfolio.spec.ts`)

Backend note: profile fields and a migration (a good first real backend
slice); certificates through `FileStorage` (PDF only, as built); GitHub
import through a GitHub sign-in via Clerk, reading the developer's public
repositories.

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
