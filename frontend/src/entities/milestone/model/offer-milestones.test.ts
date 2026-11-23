import { describe, expect, it } from "vitest";

import { depositCentsFor, isDepositPercentOption, MILESTONE_RULES, milestonesTotalCents } from "./milestone";
import { sampleMilestoneDraft } from "./sample";

describe("offer milestones (NN-16a)", () => {
  it("works out the deposit from the offer total and the agreed %", () => {
    expect(depositCentsFor(600_000, 20)).toBe(120_000);
    expect(depositCentsFor(600_000, 35)).toBe(210_000);
    expect(depositCentsFor(333_333, 20)).toBe(66_667); // rounded to the nearest cent
  });

  it("starts at 20 % and only allows the agreed steps up to 40 %", () => {
    expect(MILESTONE_RULES.depositPercentOptions[0]).toBe(MILESTONE_RULES.defaultDepositPercent);
    expect(isDepositPercentOption(30)).toBe(true);
    expect(isDepositPercentOption(15)).toBe(false);
    expect(isDepositPercentOption(50)).toBe(false);
  });

  it("starts the Lead with the minimum number of milestones, adding up to the offer total exactly", () => {
    for (const total of [600_000, 150_000, 333_333]) {
      const rows = sampleMilestoneDraft(total);
      expect(rows).toHaveLength(MILESTONE_RULES.minPerOffer);
      const cents = rows.map((row) => ({ amount_cents: Math.round(Number(row.amount) * 100) }));
      expect(milestonesTotalCents(cents)).toBe(total);
    }
  });
});
