import { describe, expect, it } from "vitest";

import { isNewRatee, overallAverage, ratingProblems, totalRatings } from "./rating";
import { SAMPLE_CLIENT_TARGETS, sampleRatingSummary, sampleReferences } from "./sample";

describe("rating summaries", () => {
  it("weights the overall average by how many ratings each kind has", () => {
    const summary = { account_id: 1, from_clients: { average: 5, count: 3 }, from_leads: { average: 4, count: 1 } };
    expect(overallAverage(summary)).toBe(4.8);
    expect(totalRatings(summary)).toBe(4);
    expect(isNewRatee(summary)).toBe(false);
  });

  it("knows a new developer has no ratings at all", () => {
    const fresh = sampleRatingSummary(8);
    expect(isNewRatee(fresh)).toBe(true);
    expect(overallAverage(fresh)).toBeNull();
    expect(sampleReferences(8)).toEqual([]);
  });

  it("keeps sample averages between 1 and 5", () => {
    for (let id = 1; id < 60; id++) {
      const { from_clients, from_leads } = sampleRatingSummary(id);
      for (const stat of [from_clients, from_leads]) {
        if (stat.average !== null) expect(stat.average).toBeGreaterThanOrEqual(1);
        if (stat.average !== null) expect(stat.average).toBeLessThanOrEqual(5);
        expect(stat.average === null).toBe(stat.count === 0);
      }
    }
  });
});

describe("ratingProblems", () => {
  it("needs stars for everyone and keeps comments short", () => {
    expect(ratingProblems(SAMPLE_CLIENT_TARGETS, {})).toEqual({
      lead: "Choose 1 to 5 stars for Ada (Team Lead).",
      team: "Choose 1 to 5 stars for The team.",
    });
    expect(
      ratingProblems(SAMPLE_CLIENT_TARGETS, {
        lead: { stars: 5, comment: "" },
        team: { stars: 4, comment: "x".repeat(601) },
      }),
    ).toEqual({ team: "Keep it under 600 characters." });
  });
});
