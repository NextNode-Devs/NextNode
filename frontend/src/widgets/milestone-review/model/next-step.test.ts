import { describe, expect, it } from "vitest";

import { nextStepText } from "./next-step";

describe("nextStepText", () => {
  it("tells each person what they do next", () => {
    expect(nextStepText("under_review", "client")).toBe("Check the work, then approve it or ask for changes.");
    expect(nextStepText("under_review", "lead")).toBe("Waiting for the client to approve it or ask for changes.");
    expect(nextStepText("in_progress", "lead")).toBe("Submit the work when it's ready for the client to review.");
    expect(nextStepText("pending_deposit", "client")).toMatch(/pay the deposit/);
    expect(nextStepText("pending_deposit", "member")).toBe("Work starts once the client pays the deposit.");
  });
});
