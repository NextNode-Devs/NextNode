import { describe, expect, it } from "vitest";

import { matchDeveloper, suggestDevelopers } from "./match";

const s = (label: string) => ({ key: label.toLowerCase(), label });
const STACK = ["React", "Django", "PostgreSQL", "TypeScript", "Docker"].map(s);

const dev = (account_id: number, display_name: string, skills: string[], is_available = true) => ({
  account_id,
  display_name,
  skills: skills.map(s),
  is_available,
});

describe("matchDeveloper", () => {
  it("counts required skills plus availability, and says why", () => {
    const match = matchDeveloper(STACK, dev(1, "Ada", ["React", "Django", "PostgreSQL", "TypeScript", "Figma"]));
    expect(match.score).toBe(83); // (4 + 1) / (5 + 1)
    expect(match.reason).toBe("4 of 5 required skills, available now");
    expect(match.missing.map((m) => m.label)).toEqual(["Docker"]);
  });

  it("scores lower when not available and says so", () => {
    const match = matchDeveloper(STACK, dev(1, "Ada", ["React"], false));
    expect(match.score).toBe(17);
    expect(match.reason).toBe("1 of 5 required skills, not available right now");
  });

  it("compares skills without caring about case or duplicates", () => {
    const match = matchDeveloper([s("React"), { key: "REACT ", label: "React" }], dev(1, "Ada", ["react"]));
    expect(match.required).toBe(1);
    expect(match.reason).toBe("1 of 1 required skill, available now");
  });
});

describe("suggestDevelopers", () => {
  const people = [
    dev(1, "Ada", ["React", "Django"]),
    dev(2, "Bea", ["React", "Django", "Docker"]),
    dev(3, "Cy", ["Rust"]),
    dev(4, "Dee", ["React", "Django", "Docker"], false),
    dev(5, "Eve", ["React", "Django", "Docker"]),
  ];

  it("ranks by score (ties: more skills first), leaves out anyone with no required skill or on the team", () => {
    const result = suggestDevelopers(STACK, people, [5]);
    expect(result.map((r) => r.developer.display_name)).toEqual(["Bea", "Dee", "Ada"]);
  });

  it("keeps to the limit", () => {
    expect(suggestDevelopers(STACK, people, [], 2)).toHaveLength(2);
  });
});
