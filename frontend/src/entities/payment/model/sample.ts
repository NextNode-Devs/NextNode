/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #96). Only prototype screens may import
 * this; never a Phase 1 screen. It matches `SAMPLE_MILESTONE_PLAN` in
 * `entities/milestone`: a CAD 6,000 offer, 20 % deposit released when the
 * client approves milestone 2. Milestone 1 is approved, milestone 2 is under
 * review, so the deposit is still held.
 *
 * The processing fee is an EXAMPLE (2.9 % + CAD 0.30, a typical Canadian card
 * rate); the real fee is read from Stripe for each charge.
 */
import type { PlannedPayment } from "./planned-payment";

const PROJECT_ID = 9001;

export const SAMPLE_PLANNED_PAYMENTS: PlannedPayment[] = [
  {
    id: 1,
    project_id: PROJECT_ID,
    kind: "deposit",
    release_milestone: 2,
    amount_cents: 120_000,
    currency: "CAD",
    state: "held",
    processing_fee_cents: 3_510,
    paid_at: "2026-11-27T15:02:00Z",
    released_at: null,
    refunded_at: null,
    receipt: {
      number: "NN-R-000101",
      issued_at: "2026-11-27T15:02:00Z",
      description: "Deposit (20 % of CAD 6,000.00)",
      method_label: "Visa ending 4242 (test card)",
    },
  },
  {
    id: 2,
    project_id: PROJECT_ID,
    kind: "final",
    release_milestone: null,
    amount_cents: 480_000,
    currency: "CAD",
    state: "due",
    processing_fee_cents: null,
    paid_at: null,
    released_at: null,
    refunded_at: null,
    receipt: null,
  },
];
