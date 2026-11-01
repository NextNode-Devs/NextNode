import { describe, expect, it } from "vitest";

import { candidacyHref, candidacyStatusText, type TeamCandidacy } from "./team";

const LEAD = 1;
const ADA = 2;

const candidacy = (overrides: Partial<TeamCandidacy>): TeamCandidacy => ({
  id: "t1",
  project_id: 10,
  lead_account_id: LEAD,
  developer_account_id: ADA,
  kind: "application",
  status: "pending",
  closed_reason: "",
  conversation_id: "c1",
  created_at: null,
  decided_at: null,
  actions: { accept: false, reject: false, withdraw: false, decline: false },
  ...overrides,
});

describe("candidacyStatusText", () => {
  it("tells each side of a pending candidacy who decides", () => {
    expect(candidacyStatusText(candidacy({}), ADA, "Ada")).toMatch(/Team Lead decides/);
    expect(candidacyStatusText(candidacy({}), LEAD, "Ada")).toMatch(/Ada applied to join/);
    const invitation = candidacy({ kind: "invitation" });
    expect(candidacyStatusText(invitation, ADA, "Ada")).toMatch(/only if you accept/);
    expect(candidacyStatusText(invitation, LEAD, "Ada")).toMatch(/Waiting for Ada/);
  });

  it("shows the server's reason when a candidacy was closed", () => {
    const closed = candidacy({ status: "closed", closed_reason: "The team is full" });
    expect(candidacyStatusText(closed, ADA, "Ada")).toBe("This application is closed: The team is full.");
    const locked = candidacy({ kind: "invitation", status: "closed", closed_reason: "Recruitment has closed" });
    expect(candidacyStatusText(locked, LEAD, "Ada")).toBe("This invitation is closed: Recruitment has closed.");
  });
});

describe("candidacyHref", () => {
  it("opens the conversation, or the project if there is none", () => {
    expect(candidacyHref({ conversation_id: "c1", project_id: 10 })).toBe("/conversations/c1");
    expect(candidacyHref({ conversation_id: null, project_id: 10 })).toBe("/projects/10");
  });
});
