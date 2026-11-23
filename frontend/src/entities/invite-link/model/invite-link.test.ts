import { describe, expect, it } from "vitest";

import { describeInviteLink, expiresIn, inviteLinkPath } from "./invite-link";
import { sampleInviteLinkByToken, sampleInviteLinks, sampleInviteToken } from "./sample";

const NOW = "2026-11-23T17:00:00.000Z"; // 12:00 p.m. in Toronto
const plus = (hours: number) => new Date(new Date(NOW).getTime() + hours * 3_600_000).toISOString();

describe("expiresIn", () => {
  it("counts hours under two days, then whole days", () => {
    expect(expiresIn(plus(0.5), NOW)).toBe("in under an hour");
    expect(expiresIn(plus(1), NOW)).toBe("in 1 hour");
    expect(expiresIn(plus(30), NOW)).toBe("in 30 hours");
    expect(expiresIn(plus(72), NOW)).toBe("in 3 days");
  });

  it("is empty once the time has passed, or for a bad value", () => {
    expect(expiresIn(plus(-1), NOW)).toBe("");
    expect(expiresIn("not a date", NOW)).toBe("");
  });
});

describe("describeInviteLink", () => {
  const { active, earlier } = sampleInviteLinks(4, NOW);

  it("shows how long an active link has left, and when that is in Toronto time", () => {
    expect(describeInviteLink(active, NOW)).toBe("Expires in 2 days (Nov 25, 12:00 p.m. ET)");
  });

  it("says when an expired link expired and who used a used one", () => {
    const [used, expired] = earlier;
    expect(describeInviteLink(expired, NOW)).toBe("Expired Nov 16, 12:00 p.m. ET");
    expect(describeInviteLink(used, NOW)).toBe("Used by Priya Raman (sample) on Nov 18, 12:00 p.m. ET");
  });
});

describe("sample invite links", () => {
  it("resolves each sample token to a link with that status, for that project", () => {
    for (const status of ["active", "expired", "used"] as const) {
      expect(sampleInviteLinkByToken(sampleInviteToken(7, status), NOW)).toMatchObject({ project_id: 7, status });
    }
  });

  it("knows nothing about any other token", () => {
    expect(sampleInviteLinkByToken("nn-7-revoked", NOW)).toBeNull();
    expect(sampleInviteLinkByToken("abc", NOW)).toBeNull();
  });

  it("keeps the active link in the future and the earlier ones in the past", () => {
    const { active, earlier } = sampleInviteLinks(4, NOW);
    expect(active.expires_at > NOW).toBe(true);
    expect(earlier.every((link) => link.expires_at < NOW)).toBe(true);
  });

  it("links to the invite screen", () => {
    expect(inviteLinkPath("nn-4-active")).toBe("/invite/nn-4-active");
  });
});
