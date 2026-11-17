/**
 * PLANNED milestone-held payments (Phase 2 prototype, NN-37 #96).
 *
 * Nothing here exists in the live product. The running integration is the
 * Phase 1 deposit (`deposit.ts`): Stripe test mode, confirmed by webhook, no
 * funds held and no payouts. These types are the planned API shape for the
 * screens that show the planned model, which are always labelled "Planned".
 * Rules: `docs/decisions/phase-2-product-decisions.md` (Payments).
 *
 * The model: the client pays a deposit up front and each milestone's payment
 * when that milestone starts. Each payment is held until its milestone is
 * approved; the deposit is held until the milestone the client chose (1 or 2)
 * is approved. Held money is refundable in full; released money is not.
 */

export type PlannedPaymentKind = "deposit" | "milestone";

/** `due` → `held` → `released`, or `held` → `refunded` when the client cancels. */
export type PlannedPaymentState = "due" | "held" | "released" | "refunded";

export type PlannedPayment = {
  id: number;
  project_id: number;
  kind: PlannedPaymentKind;
  /**
   * The milestone whose approval releases this payment: its own milestone,
   * or for the deposit, the milestone the client chose (1 or 2).
   */
  release_milestone: number;
  amount_cents: number;
  currency: "CAD";
  state: PlannedPaymentState;
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

/** What a cancellation would refund now: everything still held, in full, no fee. */
export function refundableNow(payments: readonly PlannedPayment[]): PlannedPayment[] {
  return payments.filter((item) => item.state === "held");
}
