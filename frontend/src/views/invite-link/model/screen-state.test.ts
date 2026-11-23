import { describe, expect, it } from "vitest";

import { sampleInviteLinkByToken } from "@/entities/invite-link";
import type { Project } from "@/entities/project";

import { inviterName, inviteScreenState } from "./screen-state";

const NOW = "2026-11-23T17:00:00.000Z";
const link = (status: "active" | "expired" | "used") => sampleInviteLinkByToken(`nn-4-${status}`, NOW);
const project = (viewer: Partial<Project["viewer"]> = {}, team: Partial<Project["team"]> = {}) =>
  ({
    id: 4,
    owner: { account_id: 1, display_name: "Client Co" },
    lead: { account_id: 2, display_name: "Lee Lead" },
    team: { id: 1, status: "open", size: 5, headcount: 2, open_spots: 3, ...team },
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  }) as Project;

describe("inviteScreenState", () => {
  it("lets a developer outside the team join with an active link", () => {
    expect(inviteScreenState(link("active"), project(), "developer")).toBe("ready");
  });

  it("calls an unknown token, or one whose project is gone, invalid", () => {
    expect(inviteScreenState(null, project(), "developer")).toBe("invalid");
    expect(inviteScreenState(link("active"), null, "developer")).toBe("invalid");
  });

  it("says a link is expired or used to everyone, before anything about the viewer", () => {
    expect(inviteScreenState(link("expired"), project(), "client")).toBe("expired");
    expect(inviteScreenState(link("used"), project({ is_lead: true }), "developer")).toBe("used");
  });

  it("denies clients and anyone already on the project", () => {
    expect(inviteScreenState(link("active"), project(), "client")).toBe("client");
    expect(inviteScreenState(link("active"), project({ is_member: true }), "developer")).toBe("on-team");
    expect(inviteScreenState(link("active"), project({ is_lead: true }), "developer")).toBe("on-team");
  });

  it("says when the team has no room or has stopped recruiting", () => {
    expect(inviteScreenState(link("active"), project({}, { open_spots: 0 }), "developer")).toBe("full");
    expect(inviteScreenState(link("active"), project({}, { status: "locked" }), "developer")).toBe("full");
    expect(inviteScreenState(link("active"), project({}, { size: null, open_spots: 0 }), "developer")).toBe("ready");
  });
});

describe("inviterName", () => {
  it("names the Team Lead, or the creator of a developer's own idea", () => {
    expect(inviterName(project())).toBe("Lee Lead");
    expect(inviterName({ ...project(), lead: null })).toBe("Client Co");
  });
});
