# Phase 2 product decisions

Confirmed by the Team Lead (`shar-hylton`) on 16–17 Nov 2026, after
Stakeholder Meeting 1 (Mangesh Bhattacharya). These extend
`phase-1-product-decisions.md`. Where they conflict, this file wins for Phase 2.
The machine-readable copy Claude follows is `.claude/skills/nextnode-spec/SKILL.md`.
The backlog is `../backlog-phase-2.md`.

## Deadline and way of working

- **Phase 2 (Prototype Refinement) is due 23 Nov 2026. The team aims for 22 Nov.**
- **Agile, not waterfall.** Requirements from stakeholder meetings enter the
  next iteration. Items that the Phase 1 lists called "out of scope" or
  "deferred" can move into scope when a stakeholder asks for them. Each move
  is recorded here.
- **UI prototyping comes first.** Phase 2 delivers screens and navigation
  (skeletons). Actions that are not built yet show the shared toast: "This is
  a prototype. This function is under construction."
- **Backend is allowed, but UI comes first.** Backend work is welcome where it
  helps debugging, checking facts, or fixing an API contract early, so that
  connecting the frontend later is simple. It must not change how the working
  Phase 1 flows behave. Each backlog item has a "Backend note" saying what the
  real version needs.

## Prototype screen rules

1. Phase 1 flows stay real. Phase 2 screens are added next to them. Where a
   Phase 2 change touches a working Phase 1 screen, it appears as a clearly
   marked prototype section and the working form stays untouched.
2. Each prototype screen or section shows a "Prototype" badge.
3. Sample data is allowed **only in prototype screens**. It is typed to the
   planned API shape and kept in one `sample.ts` per entity (`model/`), so
   that wiring it to the API later only changes the data source. It is never
   mixed into Phase 1 screens and never shown as real.
4. No `window.alert`. Placeholder actions use the shared toast.
5. **Toast:** built with Motion (Framer Motion, package `motion`, pinned to
   14.9.0, approved 16 Nov 2026). On desktop (≥1024 px) it drops from the top
   to the **middle of the screen**. On phones and tablets it drops a short
   distance and stays at the top centre, so it never covers the keyboard or
   the form being filled in (Team Lead, 17 Nov). It announces itself to
   screen readers (`role="status"`, errors `role="alert"`) and also serves
   the notification bell.
6. **Contact support modal:** built with Motion. It fades and scales in over a
   dimmed backdrop and shows "NextNode is a prototype. Support is not
   available yet." It traps focus, Esc and the backdrop close it, and focus
   returns to the button that opened it.

## Scope changes (moved into Phase 2)

| Item | Was | Now |
| --- | --- | --- |
| Ratings (and Team Lead references) | Out of scope | In, as a prototype (stakeholder Q4) |
| Notifications (bell, toasts) | Deferred | In, as a prototype (Q2, Q3) |
| Time-limited invitation links | Deferred | In, as a prototype |
| Milestones, submission, review, revisions | Deferred | In, as a prototype (Q1) |
| Final approval, archive, portfolio update | Deferred | In, as a prototype |
| Workspace extras: video links, updates feed | Deferred | In, as a prototype |
| Lead and member replacement mid-project | Not described | In, as a prototype (Q2) |
| Assistant Lead on developer projects | Not described | In, as a prototype (Team Lead, 17 Nov) |
| Developer matching: filters and match reason | Not described | In; rule-based match (Q4) |
| Profile growth: time zone, new talent, completeness, certificates, GitHub import | Not described | In, as a prototype (Q4) |
| Junior or new-developer spots | Not described | In, as a prototype (Q4) |
| Receipts for every payment, cancel and refund request | Not described | In, as a prototype (Q1, Q5) |
| Holding the deposit until a chosen milestone is approved | Out of scope (escrow) | **Planned flow shown as a prototype only**, see Payments |
| Dispute escalation | Not described (no admin role) | Contact support placeholder (Q5) |

Still out of scope: an admin role or console, real escrow or payouts in the
running integration, in-app video, AI matching.

## Matching

Matching is **rule-based** in Phase 2. The match score is the project's
required skills that the developer has, plus availability, and it always shows
its reason ("4 of 5 required skills, available now"). Suggested developers are
suggestions only; the Lead always chooses. A future iteration may use AI to
read the project documents and recommend skills, which also shows new
developers which skills to learn. That is not built now.

## Disputes

- The **Team Lead** handles disputes inside the team.
- Anything that needs escalation uses **Contact support**. In Phase 2 that
  opens the support modal (Prototype screen rules, rule 6).

## Legal wording: "to be defined"

Code ownership after final payment, confidentiality terms, the portfolio
exception for confidential projects, and dispute terms need proper legal
research. Screens show **"To be defined"** in those places. No legal terms are
invented. The offer acceptance is still an in-app acknowledgement for a
student prototype, not a legal contract.

## Client projects: Lead and member replacement (stakeholder Q2)

- A developer leaves or is removed → everyone is notified → the Team Lead
  picks a replacement from the applicants or invites someone, and the client
  is told.
- The Lead leaves, or does not respond for about **3 days** → the team
  proposes a new Lead from its current members → **the client approves** →
  the new Lead signs the current offer version.
- Work, files and chat history stay with the project. Whoever leaves loses
  access straight away.
- Client projects have no Assistant Lead. Replacing the Lead covers that case.

## Developer projects: Assistant Lead and inactivity (Team Lead, 17 Nov 2026)

- The creator stays the Team Lead. Nothing about the project changes.
- The **Team Lead may choose one Assistant Lead** from the members. The
  Assistant Lead can add members, remove members other than the Lead, update
  project details, and mark the project complete or closed. They **cannot
  remove the Lead or override the Lead's decisions**, and they cannot pick
  another Assistant Lead.
- **Inactivity:** if the Lead's account is inactive while the project is
  still open, the members may elect an Assistant Lead.
- **Activity check:** if the whole project is inactive, NextNode asks the
  members to confirm it is still active. If nobody confirms, the project is
  marked closed.
- Thresholds: Lead inactive for **30 days**, then **7 days** for the members to
  answer (decided 17 Nov; see the second round below).

## Payments

- **The running integration is unchanged:** Stripe test mode, the deposit
  confirmed by webhook, no funds held, no payouts.
- **Planned model, shown in prototype screens only, labelled "Planned"**
  (corrected by the Team Lead, 17 Nov 2026). The amounts are the original
  plan: a **20 % deposit** when the project starts and the **final payment**
  when the client approves the finished project. Nothing is paid per
  milestone. Only the deposit's timing changes: NextNode **holds the deposit
  until the client approves the milestone they chose (1 or 2)**, then
  releases it to the team. Until then the client can cancel and get the
  deposit back **minus Stripe's processing fee**. After that it is no longer
  refundable. The signed agreement is one part of the Team Lead's wider
  solution for cancellation and code-handover disputes. The rest is still to
  be designed.
  - Why (internal reasoning, not shown to clients or developers): the client
    gets their money back if the team produces nothing, and the team gets
    paid once it has shown working progress.
- **The deposit percentage is a term on the offer**, 20 % by default, and the
  client and Lead may agree a higher one, such as 30 % or 40 % (stakeholder
  Q1). Prototype only. The live deposit stays at `DEPOSIT_PERCENT`.
- **Every payment gets a receipt** (stakeholder Q5). Fees are shown in full:
  no NextNode fee; a refund costs **Stripe's processing fee**, which Stripe
  keeps on the original charge. The client is told this before they pay and
  again before they request a refund.
  - The fee is not a NextNode percentage. The real amount is read from the
    charge's Stripe balance transaction. Prototype screens show an example
    (2.9 % + CAD 0.30, a typical Canadian card rate).
- **Backend note:** holding and releasing funds needs Stripe Connect (separate
  charges and transfers to connected accounts, with KYC). That is a
  production-scale decision for the group's Team Lead and is not built in
  Phase 2.

## Decisions of 17 Nov 2026 (second round)

- **Deposit release milestone: the client chooses it.** When the client
  accepts the offer, they pick the milestone whose approval releases the
  deposit. A tooltip explains when the deposit is released and that it is
  refundable until then (the "proof of work" reasoning is internal and not
  shown). The deposit is still paid up front, but it is held and
  refundable until that milestone is approved. After approval it is
  released to the team and is no longer refundable. This may change later.
  - **Limited to milestone 1 or 2** (Team Lead, 17 Nov), so the team is
    never left until the last milestone with a refundable deposit. So
    **every client-project offer has at least 3 milestones**. Watch for
    small or short projects where three milestones feel forced; revisit if
    it becomes a problem.
- **Refund: the held deposit minus Stripe's processing fee** (Team Lead,
  17 Nov, replacing "full refund, no fee"), so NextNode does not lose money
  on refunds. Clients are told that a refund fee applies and that it is only
  what Stripe keeps.
- **Ratings:** the client rates the Team Lead and the team; the Lead rates
  each member; once per project, only after completion. **Hovering over (or
  focusing, or tapping on a phone) a developer's rating** opens a small card
  with Motion-animated bars: the client rating and the Team Lead rating, each
  with its count. With no ratings yet, it shows "New, no ratings yet". Phones
  have no hover, so a tap opens the same card.
- **Inactivity (developer projects only): 30 days, then 7 days to answer.**
  The goal is to keep the open-projects feed and the suggestion pool free of
  stuck projects that developers would waste time on. Flow:
  1. The Lead is inactive for 30 days while the project is open.
  2. NextNode asks the members "Is this project still active?" and hides the
     project from the feed and the suggestion pool while it waits.
  3. A member who confirms can be elected Assistant Lead, and the project
     returns to the feed.
  4. If nobody confirms within 7 days, the project is marked closed.
  Client projects are not affected.
- **Isabella has no dependency on another member.** She owns the shared
  developer filter component (NN-33 filters). Kaushalya reuses it in Hire
  Devs. The only thing she builds on is NN-31, which is done.

## Decisions of 21 Nov 2026 (NN-39, Jayraj)

- **New talent = account created in the past 15 days.** The "New talent" tag
  on developer cards, and the "New talent only" filter, show a developer only
  while their account is at most 15 days old. The API works it out from the
  account's creation time on every request (`is_new_talent`, `joined_at` on
  each directory card), so it expires by itself and nobody can set it. This
  replaces the sample value the prototype used (#102 left the rule open).
- **Assistant Lead and inactivity are built for real** (NN-39, #101), with
  these choices:
  - **Activity** is the Team Lead's messages in the project's workspace chat.
    Milestones will count too once they exist. A developer project gets its
    workspace chat when it starts, so only started projects are checked.
  - **Election:** the first member to answer "Yes, still active" becomes
    Assistant Lead if the team has none. If the Lead writes in the chat or
    answers themselves, the check ends. After any answer the 30 days restart.
  - **Closing** sets a new `Closed` status, allowed only on developer
    projects that are `Posted` or `InProgress`. The Lead or the Assistant Lead
    can also close the project themselves. The chat and history stay.
  - **Assistant Lead permissions:** closing works today. Adding and removing
    members, editing details and marking the project complete are shown as
    "Planned" until those flows accept the Assistant Lead.
  - **Scheduling:** `manage.py check_project_activity` runs the daily check
    (`--every` keeps it running; `--as-of` simulates a date for demos).
  - There is no project suggestion pool yet, so only the open-projects feed
    hides projects waiting for an answer.

## Decisions of 21 Nov 2026 (NN-34 follow-up, Jayraj)

Built for real, not as a prototype:

- **Certificates replace the resume link on portfolios.** On the edit page a
  developer uploads certificates from their computer; on the portfolio
  (`/developers/{id}`) everyone signed in sees the list, and clicking one
  opens a preview in a pop-up with a close button at the top right.
  - **PDF only** (checked by the extension and by the file's bytes); no DOCX,
    so no document-conversion package is added. Up to 10 MB each and **10
    per developer**. Shown "as provided"; NextNode never says a certificate is
    verified.
  - Files are private: served only through the API to a signed-in user, never
    by a public link.
- **The resume link is hidden, not deleted.** It no longer appears on the edit
  or view page. The API still accepts it, and saving the form sends a stored
  value back unchanged, so nothing is lost.
- **Profile completeness bar** at the top of the edit page: the share of six
  fields that are filled in, rounded **down** to a multiple of 10 % (4 of 6 is
  66 %, shown as 60 %). The six: headline, bio, skills, at least one project
  (title and repository link), GitHub username, at least one certificate.
  "Available for work" is a yes/no switch and isn't counted. It updates as the
  form changes.

## Still open

1. ~~How the deposit and milestone payments add up~~: resolved 17 Nov.
   There are no milestone payments; see Payments.
2. ~~The remaining 80 %~~: resolved 17 Nov. **One final payment** when the
   client approves the finished project (Team Lead). The stakeholder's
   per-milestone suggestion is not adopted: the client should not have to
   keep paying, and the deposit is the client's show of good will and
   commitment to the final delivery.

Nothing else is open for Phase 2 payments.

## Future builds (not Phase 2)

Kept locally in `docs/future-builds.md` (not committed).
