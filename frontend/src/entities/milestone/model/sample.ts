/**
 * PROTOTYPE SAMPLE DATA (Phase 2). Only prototype screens may import this;
 * never a Phase 1 screen. Replace with the API once milestones exist.
 * Fixed dates and ids keep server and browser renders identical.
 */
import type { Milestone, MilestonePlan } from "./milestone";

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
    status: "pending_deposit",
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
    status: "pending_deposit",
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
