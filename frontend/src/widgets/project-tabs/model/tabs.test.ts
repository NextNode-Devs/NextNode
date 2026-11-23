import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { projectTabs, workspacePrivacyNote } from "./tabs";

const viewer = (overrides: Partial<Project["viewer"]> = {}): Project["viewer"] => ({
  is_owner: false,
  is_lead: false,
  is_member: false,
  can_edit: false,
  can_upload_documents: false,
  can_read_documents: false,
  ...overrides,
});

const project = (overrides: Partial<Project> = {}) => ({ id: 4, kind: "client", viewer: viewer(), ...overrides }) as Project;
const labels = (p: Project) => projectTabs(p).map((t) => t.label);

describe("projectTabs", () => {
  it("gives someone outside the project no tabs: the Overview only", () => {
    expect(projectTabs(project())).toEqual([]);
  });

  it("gives the client everything except the team's chat", () => {
    const client = project({ viewer: viewer({ is_owner: true, can_read_documents: true }) });
    expect(labels(client)).toEqual(["Overview", "Documents", "Meetings", "Updates", "Team", "Payments"]);
  });

  it("gives the Team Lead and members every tab, linked under the project", () => {
    const member = project({ viewer: viewer({ is_member: true, can_read_documents: true }) });
    expect(labels(member)).toEqual(["Overview", "Chat", "Documents", "Meetings", "Updates", "Team", "Payments"]);
    expect(projectTabs(member).map((t) => t.href)).toEqual([
      "/projects/4",
      "/projects/4/chat",
      "/projects/4/documents",
      "/projects/4/meetings",
      "/projects/4/updates",
      "/projects/4/team",
      "/projects/4/payments",
    ]);
  });

  it("leaves out documents, team changes and payments on a developer idea", () => {
    const lead = project({ kind: "developer", viewer: viewer({ is_owner: true, is_lead: true }) });
    expect(labels(lead)).toEqual(["Overview", "Chat", "Meetings", "Updates"]);
  });
});

describe("workspacePrivacyNote", () => {
  it("tells a developer they can join, and a client only that it's private", () => {
    expect(workspacePrivacyNote(project(), "developer")).toBe(
      "This project's workspace (chat, requirement documents, meetings and updates) is private to its client and team. You'll see it if you join the team.",
    );
    expect(workspacePrivacyNote(project(), "client")).toBe(
      "This project's workspace (chat, requirement documents, meetings and updates) is private to its client and team.",
    );
  });

  it("names no client on a developer's own idea", () => {
    expect(workspacePrivacyNote(project({ kind: "developer" }), "client")).toBe(
      "This project's workspace (chat, meetings and updates) is private to its team.",
    );
  });
});
