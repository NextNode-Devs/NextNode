import { describe, expect, it } from "vitest";

import { approvedMilestones, closingStage, finalApprovalSteps } from "./closing";
import { sampleClosing } from "./sample";

describe("closingStage", () => {
  it("waits for every milestone, then for final approval, then is archived", () => {
    expect(closingStage(sampleClosing("milestones_open", 1))).toBe("milestones_open");
    expect(closingStage(sampleClosing("awaiting_final_approval", 1))).toBe("awaiting_final_approval");
    expect(closingStage(sampleClosing("archived", 1))).toBe("archived");
  });

  it("never offers final approval with no milestones", () => {
    expect(closingStage({ milestones: [], archived_at: null })).toBe("milestones_open");
  });
});

describe("sample closing", () => {
  it("adds up: deposit plus final payment is the offer total", () => {
    const c = sampleClosing("awaiting_final_approval", 7);
    expect(c.deposit_cents + c.final_payment_cents).toBe(c.total_cents);
    expect(c.project_id).toBe(7);
    expect(approvedMilestones(sampleClosing("milestones_open", 7))).toBe(2);
  });
});

describe("finalApprovalSteps", () => {
  it("keeps confidential projects off portfolios", () => {
    expect(finalApprovalSteps(false).at(-1)).toMatch(/Shipped projects/);
    expect(finalApprovalSteps(true).at(-1)).toMatch(/kept off every portfolio/);
  });
});
