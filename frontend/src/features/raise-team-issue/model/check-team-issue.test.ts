import { describe, expect, it } from "vitest";

import { checkTeamIssue, EMPTY_TEAM_ISSUE, TEAM_ISSUE_MAX_LENGTH } from "./check-team-issue";

describe("checkTeamIssue", () => {
  it("asks for a topic and details when empty", () => {
    expect(checkTeamIssue(EMPTY_TEAM_ISSUE)).toEqual({
      topic: "Choose what the issue is about.",
      details: "Describe the issue.",
    });
  });

  it("treats whitespace-only details as empty and short ones as too short", () => {
    expect(checkTeamIssue({ topic: "other", details: "   " }).details).toBe("Describe the issue.");
    expect(checkTeamIssue({ topic: "other", details: "too short" }).details).toMatch(/at least 20/);
  });

  it("rejects details over the limit", () => {
    const details = "a".repeat(TEAM_ISSUE_MAX_LENGTH + 1);
    expect(checkTeamIssue({ topic: "workload", details }).details).toMatch(/under 1000/);
  });

  it("accepts a topic with enough detail", () => {
    expect(checkTeamIssue({ topic: "deadlines", details: "The sprint review keeps moving." })).toEqual({});
  });
});
