import { describe, expect, it } from "vitest";

import { sampleShippedProjects } from "./sample";
import { hiddenConfidentialCount, listedShippedProjects } from "./shipped-project";

describe("shipped projects", () => {
  it("never lists a confidential project, and lists the newest first", () => {
    const all = sampleShippedProjects(1);
    const listed = listedShippedProjects(all);
    expect(listed.map((p) => p.title)).toEqual(["Clinic booking app", "Food bank tracker"]);
    expect(listed.some((p) => p.confidential)).toBe(false);
    expect(hiddenConfidentialCount(all)).toBe(1);
  });

  it("gives some developers none yet (the empty state)", () => {
    expect(sampleShippedProjects(3)).toEqual([]);
  });
});
