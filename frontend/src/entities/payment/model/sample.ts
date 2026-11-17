/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #96). Only prototype screens may import
 * this; never a Phase 1 screen. It matches `SAMPLE_MILESTONE_PLAN` in
 * `entities/milestone`: CAD 6,000 over 4 milestones, 20 % deposit released on
 * milestone 2. Milestone 1 is approved, milestone 2 is under review.
 *
 * To be confirmed by the Team Lead: the deposit covers 20 % of every
 * milestone, so each milestone payment is the remaining 80 % and the total
 * never exceeds the offer (1,200 + 1,200 + 1,600 + 1,200 + 800 = 6,000).
 */
import type { PlannedPayment } from "./planned-payment";

const PROJECT_ID = 9001;
const CARD = "Visa ending 4242 (test card)";

export const SAMPLE_PLANNED_PAYMENTS: PlannedPayment[] = [
  {
    id: 1,
    project_id: PROJECT_ID,
    kind: "deposit",
    release_milestone: 2,
    amount_cents: 120_000,
    currency: "CAD",
    state: "held",
    paid_at: "2026-11-27T15:02:00Z",
    released_at: null,
    refunded_at: null,
    receipt: { number: "NN-R-000101", issued_at: "2026-11-27T15:02:00Z", description: "Deposit (20 % of CAD 6,000.00)", method_label: CARD },
  },
  {
    id: 2,
    project_id: PROJECT_ID,
    kind: "milestone",
    release_milestone: 1,
    amount_cents: 120_000,
    currency: "CAD",
    state: "released",
    paid_at: "2026-11-27T15:04:00Z",
    released_at: "2026-12-04T14:05:00Z",
    refunded_at: null,
    receipt: { number: "NN-R-000102", issued_at: "2026-11-27T15:04:00Z", description: "Milestone 1: Designs and project setup", method_label: CARD },
  },
  {
    id: 3,
    project_id: PROJECT_ID,
    kind: "milestone",
    release_milestone: 2,
    amount_cents: 160_000,
    currency: "CAD",
    state: "held",
    paid_at: "2026-12-04T14:30:00Z",
    released_at: null,
    refunded_at: null,
    receipt: { number: "NN-R-000117", issued_at: "2026-12-04T14:30:00Z", description: "Milestone 2: Accounts and booking flow", method_label: CARD },
  },
  {
    id: 4,
    project_id: PROJECT_ID,
    kind: "milestone",
    release_milestone: 3,
    amount_cents: 120_000,
    currency: "CAD",
    state: "due",
    paid_at: null,
    released_at: null,
    refunded_at: null,
    receipt: null,
  },
  {
    id: 5,
    project_id: PROJECT_ID,
    kind: "milestone",
    release_milestone: 4,
    amount_cents: 80_000,
    currency: "CAD",
    state: "due",
    paid_at: null,
    released_at: null,
    refunded_at: null,
    receipt: null,
  },
];
