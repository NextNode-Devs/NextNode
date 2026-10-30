import { describe, expect, it } from "vitest";

import { leadStatusText, type LeadCandidacy } from "./lead-candidacy";

const CLIENT = 1;
const ADA = 2;

const candidacy = (overrides: Partial<LeadCandidacy>): LeadCandidacy => ({
  id: "l1",
  project_id: 10,
  client_account_id: CLIENT,
  developer_account_id: ADA,
  kind: "application",
  status: "candidate",
  note: "",
  conversation_id: "c1",
  created_at: null,
  decided_at: null,
  actions: { accept: false, decline: false, withdraw: false, hire: false },
  ...overrides,
});

describe("leadStatusText", () => {
  it.each([
    ["invited", "invitation", ADA, /invited to lead/],
    ["invited", "invitation", CLIENT, /Waiting for Ada/],
    ["candidate", "application", ADA, /You've applied/],
    ["candidate", "invitation", ADA, /accepted the invitation/],
    ["candidate", "application", CLIENT, /Ada is a candidate/],
    ["hired", "application", ADA, /You were hired/],
    ["hired", "application", CLIENT, /You hired Ada/],
    ["declined", "invitation", CLIENT, /Ada declined/],
    ["withdrawn", "application", ADA, /You withdrew/],
    ["closed", "application", ADA, /Another candidate was hired/],
  ] as const)("%s %s as viewer %i", (status, kind, viewer, expected) => {
    expect(leadStatusText(candidacy({ status, kind }), viewer, "Ada")).toMatch(expected);
  });
});
