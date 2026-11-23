import { describe, expect, it } from "vitest";

import { daysBetween, isLeadUnresponsive, openSpots, teamViewer } from "./replacement";
import { SAMPLE_TEAM_SITUATIONS, sampleTeamChanges } from "./replacement-sample";

const viewer = (v: Partial<{ is_owner: boolean; is_lead: boolean; is_member: boolean }>) => ({
  is_owner: false,
  is_lead: false,
  is_member: false,
  ...v,
});

describe("teamViewer", () => {
  it("names the client, the Lead and a member, and nobody else", () => {
    expect(teamViewer(viewer({ is_owner: true }))).toBe("client");
    expect(teamViewer(viewer({ is_lead: true }))).toBe("lead");
    expect(teamViewer(viewer({ is_member: true }))).toBe("member");
    expect(teamViewer(viewer({}))).toBeNull();
  });
});

describe("isLeadUnresponsive", () => {
  it("is true from 3 full days without a word", () => {
    expect(isLeadUnresponsive("2026-11-17T18:00:00Z", "2026-11-20T17:59:00Z")).toBe(false);
    expect(isLeadUnresponsive("2026-11-17T18:00:00Z", "2026-11-20T18:00:00Z")).toBe(true);
  });

  it("never counts bad or backwards dates", () => {
    expect(daysBetween("not a date", "2026-11-20T18:00:00Z")).toBe(0);
    expect(daysBetween("2026-11-21T00:00:00Z", "2026-11-20T00:00:00Z")).toBe(0);
  });
});

describe("sample team", () => {
  it("has one open spot after a member left, and none otherwise", () => {
    expect(openSpots(sampleTeamChanges("member_left"))).toBe(1);
    expect(openSpots(sampleTeamChanges("steady"))).toBe(0);
  });

  it("keeps every team at 5 to 7 people with exactly one Lead", () => {
    for (const situation of SAMPLE_TEAM_SITUATIONS) {
      const snapshot = sampleTeamChanges(situation);
      expect(snapshot.team_size).toBeGreaterThanOrEqual(5);
      expect(snapshot.team_size).toBeLessThanOrEqual(7);
      expect(snapshot.seats.filter((s) => s.role === "lead")).toHaveLength(1);
    }
  });

  it("shows the Lead as unresponsive only when they are", () => {
    const quiet = sampleTeamChanges("lead_unresponsive");
    const steady = sampleTeamChanges("steady");
    expect(isLeadUnresponsive(quiet.lead_last_active_at, quiet.as_of)).toBe(true);
    expect(isLeadUnresponsive(steady.lead_last_active_at, steady.as_of)).toBe(false);
  });

  it("labels every sample person as sample data", () => {
    for (const situation of SAMPLE_TEAM_SITUATIONS) {
      const snapshot = sampleTeamChanges(situation);
      for (const name of [...snapshot.seats, ...snapshot.candidates].map((p) => p.display_name)) {
        expect(name).toMatch(/\(sample\)$/);
      }
    }
  });
});
