import { describe, expect, it } from "vitest";

import { groupUpdatesByMilestone, latestUpdate } from "./project-update";
import { SAMPLE_PROJECT_UPDATES } from "./sample";

describe("groupUpdatesByMilestone", () => {
  it("puts the latest milestone first and 'before work started' last", () => {
    const groups = groupUpdatesByMilestone(SAMPLE_PROJECT_UPDATES);
    expect(groups.map((g) => g.milestone_sequence)).toEqual([2, 1, null]);
  });

  it("orders each group newest first, whatever order the posts arrive in", () => {
    const shuffled = [...SAMPLE_PROJECT_UPDATES].reverse();
    const first = groupUpdatesByMilestone(shuffled)[1];
    expect(first.updates.map((u) => u.id)).toEqual([5, 4, 3]);
  });

  it("returns no groups for no updates", () => {
    expect(groupUpdatesByMilestone([])).toEqual([]);
  });
});

describe("latestUpdate", () => {
  it("finds the newest post, or nothing", () => {
    expect(latestUpdate(SAMPLE_PROJECT_UPDATES)?.id).toBe(7);
    expect(latestUpdate([])).toBeUndefined();
  });
});
