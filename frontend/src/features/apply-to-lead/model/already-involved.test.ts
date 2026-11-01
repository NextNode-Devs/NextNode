import { describe, expect, it } from "vitest";

import type { LeadChat } from "@/entities/lead-candidacy";

import { alreadyInvolved } from "./already-involved";

const chat = (overrides: Partial<LeadChat>): LeadChat => ({
  candidacy_id: "a",
  developer_account_id: 2,
  developer_name: "Ada",
  kind: "application",
  status: "candidate",
  conversation_id: "c-a",
  ...overrides,
});

describe("alreadyInvolved (Apply to lead)", () => {
  it("hides Apply once there is an application or an open invitation, not after a declined invitation", () => {
    expect(alreadyInvolved([])).toBe(false);
    expect(alreadyInvolved([chat({ status: "withdrawn" })])).toBe(true); // applying is once only
    expect(alreadyInvolved([chat({ kind: "invitation", status: "invited" })])).toBe(true);
    expect(alreadyInvolved([chat({ kind: "invitation", status: "declined" })])).toBe(false);
  });
});
