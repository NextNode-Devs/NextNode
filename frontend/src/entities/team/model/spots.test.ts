import { describe, expect, it } from "vitest";

import { sampleJuniorCount } from "./sample";
import { clampJunior, juniorCount, juniorSpotsLine, newTalentHireDevsHref, spotsWithJunior } from "./spots";

describe("junior spots", () => {
  it("marks the first spots junior, never more than are open", () => {
    expect(spotsWithJunior(3, 1).map((s) => s.type)).toEqual(["junior", "standard", "standard"]);
    expect(juniorCount(spotsWithJunior(2, 5))).toBe(2);
    expect(clampJunior(3, -1)).toBe(0);
    expect(spotsWithJunior(0, 2)).toEqual([]);
  });

  it("says how many are junior in plain words", () => {
    expect(juniorSpotsLine(spotsWithJunior(3, 1))).toBe("1 of 3 open spots is for junior developers.");
    expect(juniorSpotsLine(spotsWithJunior(3, 2))).toBe("2 of 3 open spots are for junior developers.");
    expect(juniorSpotsLine(spotsWithJunior(1, 1))).toBe("The open spot is for a junior developer.");
    expect(juniorSpotsLine(spotsWithJunior(2, 0))).toBe("None of the 2 open spots are marked junior.");
    expect(juniorSpotsLine([])).toBe("No open spots.");
  });

  it("links to Hire Devs showing new talent only", () => {
    expect(newTalentHireDevsHref(4)).toBe("/projects/4/hire-devs?new_talent=true");
  });

  it("samples one junior spot when two or more are open", () => {
    expect(sampleJuniorCount(1)).toBe(0);
    expect(sampleJuniorCount(3)).toBe(1);
  });
});
