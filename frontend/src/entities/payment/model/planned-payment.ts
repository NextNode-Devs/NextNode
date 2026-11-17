/**
 * PLANNED deposit holding (Phase 2 prototype, NN-37 #96).
 *
 * The amounts are the existing plan: a 20 % deposit when the project starts
 * (as in Phase 1) and the final payment when the client approves the
 * finished project. What is planned (not live) is WHEN the team gets the
 * deposit: it is held until the client approves the milestone they chose
 * (1 or 2). Until then a cancelled project refunds the deposit minus Stripe's
 * processing fee, which Stripe keeps on a refund. After that it is released
 * and no longer refundable.
 *
 * The running integration is still the Phase 1 deposit (`deposit.ts`):
 * Stripe test mode, confirmed by webhook, nothing held, no payouts. Screens
 * using these types are labelled "Planned".
 * Rules: `docs/decisions/phase-2-product-decisions.md` (Payments).
 */

export type PlannedPaymentKind = "deposit" | "final";

/** `due` → `held` → `released` (deposit), `due` → `released` (final), or `held` → `refunded`. */
export type PlannedPaymentState = "due" | "held" | "released" | "refunded";

export type PlannedPayment = {
  id: number;
  project_id: number;
  kind: PlannedPaymentKind;
  /** Deposit: the milestone (1 or 2) whose approval releases it. Final payment: `null`. */
  release_milestone: number | null;
  amount_cents: number;
  currency: "CAD";
  state: PlannedPaymentState;
  /**
   * Stripe's processing fee on this charge, withheld if it is refunded. The
   * real value comes from the charge's Stripe balance transaction; `null`
   * until the client has paid.
   */
  processing_fee_cents: number | null;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  /** Issued for every payment the client makes (stakeholder Q5). */
  receipt: PlannedReceipt | null;
};

export type PlannedReceipt = {
  number: string;
  issued_at: string;
  description: string;
  /** e.g. "Visa ending 4242 (test card)". */
  method_label: string;
};

export const PLANNED_PAYMENT_STATE_LABEL: Record<PlannedPaymentState, string> = {
  due: "Not paid yet",
  held: "Held",
  released: "Released to the team",
  refunded: "Refunded",
};

export type PlannedPaymentTotals = {
  paid_cents: number;
  held_cents: number;
  released_cents: number;
  due_cents: number;
};

export function plannedPaymentTotals(payments: readonly PlannedPayment[]): PlannedPaymentTotals {
  const sum = (state: PlannedPaymentState) =>
    payments.filter((item) => item.state === state).reduce((total, item) => total + item.amount_cents, 0);
  const held = sum("held");
  const released = sum("released");
  return { paid_cents: held + released, held_cents: held, released_cents: released, due_cents: sum("due") };
}

/** What a cancellation would refund now: anything still held (in practice, the deposit). */
export function refundableNow(payments: readonly PlannedPayment[]): PlannedPayment[] {
  return payments.filter((item) => item.state === "held");
}

/** What the client gets back for one held payment: the amount minus Stripe's processing fee. */
export function refundAmountCents(payment: PlannedPayment): number {
  return Math.max(0, payment.amount_cents - (payment.processing_fee_cents ?? 0));
}
