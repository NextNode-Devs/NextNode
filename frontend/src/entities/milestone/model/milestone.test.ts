import { describe, expect, it } from "vitest";

import {
  isDepositReleaseChoice,
  MILESTONE_RULES,
  milestoneScheduleProblems,
  milestonesTotalCents,
} from "./milestone";
import { SAMPLE_MILESTONE_PLAN, SAMPLE_MILESTONES } from "./sample";

const row = (sequence: number, amount_cents: number, due_date: string, title = `M${sequence}`) => ({
  sequence,
  title,
  amount_cents,
  due_date,
});

describe("milestone rules", () => {
  it("releases the deposit only on milestone 1 or 2", () => {
    expect(MILESTONE_RULES.depositReleaseChoices).toEqual([1, 2]);
    expect(isDepositReleaseChoice(1)).toBe(true);
    expect(isDepositReleaseChoice(2)).toBe(true);
    expect(isDepositReleaseChoice(3)).toBe(false);
  });

  it("adds amounts in cents", () => {
    expect(milestonesTotalCents(SAMPLE_MILESTONES)).toBe(600_000);
  });

  it("accepts a valid schedule of 3", () => {
    const schedule = [row(1, 50_000, "2027-01-01"), row(2, 50_000, "2027-01-15"), row(3, 50_000, "2027-02-01")];
    expect(milestoneScheduleProblems(schedule, 150_000)).toEqual([]);
  });

  it("refuses fewer than 3 milestones", () => {
    const schedule = [row(1, 100_000, "2027-01-01"), row(2, 50_000, "2027-01-15")];
    expect(milestoneScheduleProblems(schedule, 150_000)).toContain("An offer needs at least 3 milestones.");
  });

  it("names every problem: gaps, blank titles, zero amounts, wrong total, dates out of order", () => {
    const schedule = [row(1, 0, "2027-02-01", " "), row(2, 50_000, "2027-01-01"), row(4, 50_000, "2027-03-01")];
    expect(milestoneScheduleProblems(schedule, 150_000)).toEqual([
      "Milestones must be numbered 1, 2, 3 … without gaps.",
      "Every milestone needs a title.",
      "Every milestone needs an amount above zero.",
      "The milestone amounts must add up to the offer total.",
      "Each milestone must be due after the one before it.",
    ]);
  });

  it("ships a sample plan that follows its own rules", () => {
    const { milestones, deposit_release_milestone } = SAMPLE_MILESTONE_PLAN;
    expect(milestoneScheduleProblems(milestones, milestonesTotalCents(milestones))).toEqual([]);
    expect(deposit_release_milestone && isDepositReleaseChoice(deposit_release_milestone)).toBe(true);
  });
});
