import { describe, expect, it } from "vitest";

import { plannedPaymentTotals, refundableNow, refundAmountCents, type PlannedPayment } from "./planned-payment";
import { SAMPLE_PLANNED_PAYMENTS } from "./sample";

describe("planned payments", () => {
  it("adds paid, held, released and due amounts", () => {
    expect(plannedPaymentTotals(SAMPLE_PLANNED_PAYMENTS)).toEqual({
      paid_cents: 120_000,
      held_cents: 120_000,
      released_cents: 0,
      due_cents: 480_000,
    });
  });

  it("is the original plan: a 20 % deposit plus the final payment, equal to the offer", () => {
    const [deposit, final] = SAMPLE_PLANNED_PAYMENTS;
    expect(deposit.kind).toBe("deposit");
    expect(final.kind).toBe("final");
    expect(deposit.amount_cents + final.amount_cents).toBe(600_000);
    expect(deposit.amount_cents).toBe(600_000 * 0.2);
  });

  it("refunds only what is still held", () => {
    expect(refundableNow(SAMPLE_PLANNED_PAYMENTS).map((item) => item.id)).toEqual([1]);
  });

  it("refunds the deposit minus Stripe's processing fee", () => {
    expect(refundAmountCents(SAMPLE_PLANNED_PAYMENTS[0])).toBe(120_000 - 3_510);
  });

  it("never refunds a negative amount, and refunds in full when no fee is known", () => {
    const base = SAMPLE_PLANNED_PAYMENTS[0];
    const tiny: PlannedPayment = { ...base, amount_cents: 100, processing_fee_cents: 500 };
    const noFee: PlannedPayment = { ...base, processing_fee_cents: null };
    expect(refundAmountCents(tiny)).toBe(0);
    expect(refundAmountCents(noFee)).toBe(120_000);
  });

  it("issues a receipt for every payment the client made, and none for unpaid ones", () => {
    for (const payment of SAMPLE_PLANNED_PAYMENTS) {
      expect(payment.receipt !== null).toBe(payment.paid_at !== null);
    }
  });
});
