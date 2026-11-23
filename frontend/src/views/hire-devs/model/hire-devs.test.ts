import { describe, expect, it } from "vitest";

import { NO_FILTERS, SAMPLE_HIRE_DEVS_POOL, sampleProfileGrowth, type DeveloperCardData } from "@/entities/developer";
import type { Project } from "@/entities/project";

import { hireDevsAccess, rankDevelopers } from "./hire-devs";

const skill = (label: string) => ({ key: label.toLowerCase(), label });
const project = (viewer: Partial<Project["viewer"]>, team: Partial<Project["team"]> = {}) =>
  ({
    id: 4,
    tech_stack: [skill("React"), skill("Django")],
    team: { id: 1, status: "open", size: 5, headcount: 2, open_spots: 3, ...team },
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  }) as Project;

describe("hireDevsAccess", () => {
  it("lets only the Team Lead in", () => {
    expect(hireDevsAccess(project({ is_lead: true }))).toBe("ok");
    expect(hireDevsAccess(project({ is_member: true }))).toBe("not-lead");
    expect(hireDevsAccess(project({ is_owner: true }))).toBe("not-lead");
  });

  it("stops when the team is full or no longer recruiting", () => {
    expect(hireDevsAccess(project({ is_lead: true }, { open_spots: 0 }))).toBe("full");
    expect(hireDevsAccess(project({ is_lead: true }, { status: "locked" }))).toBe("closed");
  });

  it("keeps a team with no size chosen yet open", () => {
    expect(hireDevsAccess(project({ is_lead: true }, { size: null, open_spots: 0 }))).toBe("ok");
  });
});

const dev = (id: number, name: string, skills: string[], available = true): DeveloperCardData => ({
  account_id: id,
  display_name: name,
  headline: `${name} builds things`,
  skills: skills.map(skill),
  is_available: available,
  project_count: 1,
  joined_at: "2026-05-01T12:00:00Z",
  is_new_talent: false,
});

describe("rankDevelopers", () => {
  const pool = [dev(1, "Ada", ["React"]), dev(2, "Grace", ["React", "Django"]), dev(4, "Linus", ["Go"], false)];
  const stack = { tech_stack: [skill("React"), skill("Django")] };

  it("ranks by match, best first, each with its reason", () => {
    const ranked = rankDevelopers(pool, stack, NO_FILTERS);
    expect(ranked.map((m) => m.developer.display_name)).toEqual(["Grace", "Ada", "Linus"]);
    expect(ranked[0].match.reason).toBe("2 of 2 required skills, available now");
  });

  it("applies the shared filters: search, every skill and availability", () => {
    const names = (filters: Partial<typeof NO_FILTERS>) =>
      rankDevelopers(pool, stack, { ...NO_FILTERS, ...filters }).map((m) => m.developer.display_name);
    expect(names({ q: "grace" })).toEqual(["Grace"]);
    expect(names({ skills: ["react", "Django"] })).toEqual(["Grace"]);
    expect(names({ available: true })).toEqual(["Grace", "Ada"]);
  });

  it("filters new talent on the card's own value, not the sample profile value", () => {
    const newcomer = { ...dev(7, "Zed", ["React"]), is_new_talent: true };
    // The sample profile values disagree with the card both ways: 7 is not new there, 6 is.
    expect(sampleProfileGrowth(7).is_new_talent).toBe(false);
    expect(sampleProfileGrowth(6).is_new_talent).toBe(true);
    const ranked = rankDevelopers([newcomer, dev(6, "Old", ["React"])], stack, { ...NO_FILTERS, new_talent: true });
    expect(ranked.map((m) => m.developer.display_name)).toEqual(["Zed"]);
    expect(ranked[0].growth.is_new_talent).toBe(true);
  });

  it("keeps the sample pool's new talent consistent with when each developer joined", () => {
    const newcomers = SAMPLE_HIRE_DEVS_POOL.filter((d) => d.is_new_talent);
    expect(newcomers.length).toBeGreaterThan(0);
    for (const d of SAMPLE_HIRE_DEVS_POOL) expect(d.is_new_talent).toBe((d.joined_at ?? "") >= "2026-11-07");
  });

  it("applies the time zone from the sample profile values", () => {
    const zone = sampleProfileGrowth(9001).time_zone ?? "";
    const ranked = rankDevelopers(SAMPLE_HIRE_DEVS_POOL, stack, { ...NO_FILTERS, time_zone: zone });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((m) => sampleProfileGrowth(m.developer.account_id).time_zone === zone)).toBe(true);
  });
});
