import { describe, expect, it } from "vitest";

import { sampleProfileGrowth } from "./sample";
import { compareMatches, matchReason, scoreMatch, type DeveloperMatch } from "./match";

const skill = (label: string) => ({ key: label.toLowerCase(), label });
const stack = ["React", "TypeScript", "Django", "PostgreSQL", "Docker"].map(skill);

describe("scoreMatch", () => {
  it("counts the required skills the developer has, plus availability, and says why", () => {
    const match = scoreMatch(stack, { skills: ["React", "TypeScript", "Django", "PostgreSQL"].map(skill), is_available: true });
    expect(match.reason).toBe("4 of 5 required skills, available now");
    expect(match.score).toBe(83); // 5 of 6 points
    expect(match.missing_skills.map((s) => s.label)).toEqual(["Docker"]);
  });

  it("compares skills case-insensitively and ignores skills the project doesn't need", () => {
    const match = scoreMatch([skill("React")], { skills: [{ key: "REACT", label: "React" }, skill("Go")], is_available: false });
    expect(match.matched_skills).toHaveLength(1);
    expect(match.reason).toBe("1 of 1 required skill, not available right now");
    expect(match.score).toBe(50);
  });

  it("counts a skill listed twice on the project once", () => {
    expect(scoreMatch([skill("React"), skill("react")], { skills: [], is_available: false }).required_count).toBe(1);
  });

  it("scores on availability alone when the project lists no skills", () => {
    expect(scoreMatch([], { skills: [skill("React")], is_available: true })).toMatchObject({
      score: 100,
      reason: "No required skills listed, available now",
    });
  });
});

describe("matchReason", () => {
  it("reads naturally for none and all", () => {
    expect(matchReason(0, 3, false)).toBe("0 of 3 required skills, not available right now");
    expect(matchReason(3, 3, true)).toBe("3 of 3 required skills, available now");
  });
});

describe("compareMatches", () => {
  const entry = (name: string, skills: string[], available: boolean): DeveloperMatch => {
    const developer = { account_id: 1, display_name: name, headline: "", skills: skills.map(skill), is_available: available, project_count: 0 };
    return { developer, growth: sampleProfileGrowth(1), match: scoreMatch(stack, developer) };
  };

  it("puts the best match first, then more skills, then by name", () => {
    const sorted = [
      entry("Cy", ["React"], true), // 2 points
      entry("Bo", ["React", "Docker"], false), // 2 points, more skills
      entry("Al", ["React"], true), // 2 points
      entry("Di", ["React", "Docker", "Django"], true), // 4 points
    ].sort(compareMatches);
    expect(sorted.map((m) => m.developer.display_name)).toEqual(["Di", "Bo", "Al", "Cy"]);
  });
});
