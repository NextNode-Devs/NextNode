/**
 * PROTOTYPE SAMPLE DATA (Phase 2). Only prototype screens may import this;
 * never a Phase 1 screen. Replace with the API once milestones exist.
 * Fixed dates and ids keep server and browser renders identical.
 */
import type { Milestone, MilestonePlan } from "./milestone";
import type { MilestoneReview } from "./review";

const PROJECT_ID = 9001;

export const SAMPLE_MILESTONES: Milestone[] = [
  {
    id: 1,
    project_id: PROJECT_ID,
    sequence: 1,
    title: "Designs and project setup",
    description: "Approved screen designs, repository, CI and staging environment.",
    amount_cents: 150_000,
    due_date: "2026-12-04",
    status: "completed",
    submitted_at: "2026-12-03T16:20:00Z",
    approved_at: "2026-12-04T14:05:00Z",
  },
  {
    id: 2,
    project_id: PROJECT_ID,
    sequence: 2,
    title: "Accounts and booking flow",
    description: "Sign-up, sign-in and the end-to-end booking flow on staging.",
    amount_cents: 200_000,
    due_date: "2026-12-18",
    status: "under_review",
    submitted_at: "2026-12-17T21:40:00Z",
    approved_at: null,
  },
  {
    id: 3,
    project_id: PROJECT_ID,
    sequence: 3,
    title: "Payments and notifications",
    description: "Checkout, receipts and email notifications.",
    amount_cents: 150_000,
    due_date: "2027-01-08",
    status: "not_started",
    submitted_at: null,
    approved_at: null,
  },
  {
    id: 4,
    project_id: PROJECT_ID,
    sequence: 4,
    title: "Launch and handover",
    description: "Production launch, documentation and handover.",
    amount_cents: 100_000,
    due_date: "2027-01-22",
    status: "not_started",
    submitted_at: null,
    approved_at: null,
  },
];

/** An accepted offer: CAD 6,000 over four milestones, deposit released on milestone 2. */
export const SAMPLE_MILESTONE_PLAN: MilestonePlan = {
  project_id: PROJECT_ID,
  offer_version: 2,
  deposit_percent: 20,
  deposit_release_milestone: 2,
  milestones: SAMPLE_MILESTONES,
};

/* ---------- Review history (NN-16b #95) ---------- */

const LEAD = { author_name: "Ada", author_role: "lead" as const };
const CLIENT = { author_name: "Grace", author_role: "client" as const };
const STAGING = "https://staging.example.com";

const M1_REVIEWS: MilestoneReview[] = [
  {
    id: 101,
    milestone_id: 1,
    kind: "submitted",
    note: "Screen designs for every page, the repository with CI, and the staging site are ready.",
    link_url: STAGING,
    ...LEAD,
    created_at: "2026-12-01T18:10:00Z",
  },
  {
    id: 102,
    milestone_id: 1,
    kind: "revision_requested",
    note: "The booking screen needs a phone layout, and please use our brand colours on the buttons.",
    link_url: null,
    ...CLIENT,
    created_at: "2026-12-02T15:30:00Z",
  },
  {
    id: 103,
    milestone_id: 1,
    kind: "submitted",
    note: "Added the phone layout for booking and switched the buttons to your brand colours.",
    link_url: STAGING,
    ...LEAD,
    created_at: "2026-12-03T16:20:00Z",
  },
  { id: 104, milestone_id: 1, kind: "approved", note: "", link_url: null, ...CLIENT, created_at: "2026-12-04T14:05:00Z" },
];

const M2_FIRST_TRY: MilestoneReview[] = [
  {
    id: 201,
    milestone_id: 2,
    kind: "submitted",
    note: "Sign-up, sign-in and booking work end to end on staging. Test account details are in the chat.",
    link_url: `${STAGING}/book`,
    ...LEAD,
    created_at: "2026-12-14T20:00:00Z",
  },
  {
    id: 202,
    milestone_id: 2,
    kind: "revision_requested",
    note: "Booking a slot twice in a row shows an error. Customers also need a confirmation email.",
    link_url: null,
    ...CLIENT,
    created_at: "2026-12-15T17:45:00Z",
  },
];

const M2_RESUBMITTED: MilestoneReview = {
  id: 203,
  milestone_id: 2,
  kind: "submitted",
  note: "Fixed the double booking and added the confirmation email.",
  link_url: `${STAGING}/book`,
  ...LEAD,
  created_at: "2026-12-17T21:40:00Z",
};

/** Matches `SAMPLE_MILESTONES`: milestone 1 went round once, milestone 2 is waiting for the client again. */
export const SAMPLE_MILESTONE_REVIEWS: MilestoneReview[] = [...M1_REVIEWS, ...M2_FIRST_TRY, M2_RESUBMITTED];

/** Prototype only: the points in the loop a tester can switch between. */
export type MilestoneSampleSituation = "awaiting_deposit" | "revision_requested" | "under_review" | "all_completed" | "no_milestones";

export const MILESTONE_SAMPLE_SITUATIONS: { value: MilestoneSampleSituation; label: string }[] = [
  { value: "awaiting_deposit", label: "Waiting for the deposit" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "under_review", label: "Waiting for review" },
  { value: "all_completed", label: "All completed" },
  { value: "no_milestones", label: "No milestones yet" },
];

export type MilestoneSample = { milestones: Milestone[]; reviews: MilestoneReview[] };

const LAST_APPROVALS: MilestoneReview[] = [2, 3, 4].flatMap((n, index) => {
  const day = ["2026-12-18", "2027-01-07", "2027-01-21"][index];
  return [
    {
      id: 300 + n * 2,
      milestone_id: n,
      kind: "submitted" as const,
      note: `Milestone ${n} is ready on staging.`,
      link_url: STAGING,
      ...LEAD,
      created_at: `${day}T15:00:00Z`,
    },
    { id: 301 + n * 2, milestone_id: n, kind: "approved" as const, note: "", link_url: null, ...CLIENT, created_at: `${day}T21:00:00Z` },
  ];
});

/** The sample milestones and their history at one point in the loop. */
export function sampleMilestoneSituation(situation: MilestoneSampleSituation): MilestoneSample {
  switch (situation) {
    case "no_milestones":
      return { milestones: [], reviews: [] };
    case "awaiting_deposit":
      return {
        milestones: SAMPLE_MILESTONES.map((m) => ({ ...m, status: "pending_deposit", submitted_at: null, approved_at: null })),
        reviews: [],
      };
    case "revision_requested":
      return {
        milestones: SAMPLE_MILESTONES.map((m) =>
          m.sequence === 2 ? { ...m, status: "in_progress", submitted_at: M2_FIRST_TRY[0].created_at } : m,
        ),
        reviews: [...M1_REVIEWS, ...M2_FIRST_TRY],
      };
    case "all_completed":
      return {
        milestones: SAMPLE_MILESTONES.map((m) => {
          const approval = LAST_APPROVALS.find((r) => r.milestone_id === m.id && r.kind === "approved");
          const submission = LAST_APPROVALS.find((r) => r.milestone_id === m.id && r.kind === "submitted");
          return approval && submission
            ? { ...m, status: "completed", submitted_at: submission.created_at, approved_at: approval.created_at }
            : m;
        }),
        reviews: [...M1_REVIEWS, ...LAST_APPROVALS],
      };
    case "under_review":
    default:
      return { milestones: SAMPLE_MILESTONES, reviews: SAMPLE_MILESTONE_REVIEWS };
  }
}

/* ---------- Offer milestone draft (NN-16a #94) ---------- */

/** The first three milestones a Team Lead starts from: 30 / 40 / 30 % of the offer total. */
const DRAFT_SHAPE = [
  { title: "Designs and project setup", share: 30, due_date: "2027-01-15" },
  { title: "Core features on staging", share: 40, due_date: "2027-02-12" },
  { title: "Launch and handover", share: 30, due_date: "2027-03-05" },
] as const;

export type MilestoneDraftRow = { key: string; title: string; amount: string; due_date: string };

/**
 * A starting schedule for the offer-milestones prototype: three rows that add
 * up to the offer total exactly (the last row takes any rounding). Fixed
 * dates, so server and browser renders match.
 */
export function sampleMilestoneDraft(offerTotalCents: number): MilestoneDraftRow[] {
  let left = offerTotalCents;
  return DRAFT_SHAPE.map((row, index) => {
    const cents = index === DRAFT_SHAPE.length - 1 ? left : Math.round((offerTotalCents * row.share) / 100);
    left -= cents;
    return { key: `m${index + 1}`, title: row.title, amount: (cents / 100).toFixed(2), due_date: row.due_date };
  });
}
