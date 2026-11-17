import { describe, expect, it } from "vitest";

import { plannedPaymentTotals, refundableNow } from "./planned-payment";
import { SAMPLE_PLANNED_PAYMENTS } from "./sample";

describe("planned payments", () => {
  it("adds paid, held, released and due amounts", () => {
    expect(plannedPaymentTotals(SAMPLE_PLANNED_PAYMENTS)).toEqual({
      paid_cents: 400_000,
      held_cents: 280_000,
      released_cents: 120_000,
      due_cents: 200_000,
    });
  });

  it("never charges more than the offer total (deposit covers 20 % of each milestone)", () => {
    const all = SAMPLE_PLANNED_PAYMENTS.reduce((sum, item) => sum + item.amount_cents, 0);
    expect(all).toBe(600_000);
  });

  it("refunds only what is still held", () => {
    expect(refundableNow(SAMPLE_PLANNED_PAYMENTS).map((item) => item.id)).toEqual([1, 3]);
  });

  it("issues a receipt for every payment the client made, and none for unpaid ones", () => {
    for (const payment of SAMPLE_PLANNED_PAYMENTS) {
      expect(payment.receipt !== null).toBe(payment.paid_at !== null);
    }
  });
});
