import { describe, expect, it } from "vitest";

import { completenessOf } from "./completeness";
import type { PortfolioDraft } from "./draft";

const EMPTY: PortfolioDraft = {
  headline: "",
  bio: "",
  github_username: "",
  skills: [],
  projects: [],
  resume_url: "",
  is_available: false,
};

const project = (title: string, repository_url: string) => ({ key: "p", title, repository_url, demo_url: "" });

describe("completenessOf", () => {
  it("counts six fields and rounds down to a multiple of 10", () => {
    expect(completenessOf(EMPTY, 0)).toMatchObject({ percent: 0, filled: 0, total: 6 });
    expect(completenessOf({ ...EMPTY, headline: "Dev" }, 0).percent).toBe(10); // 1 of 6 is 16 %
    const four = { ...EMPTY, headline: "Dev", bio: "Hi", skills: ["React"], github_username: "ada" };
    expect(completenessOf(four, 0)).toMatchObject({ percent: 60, filled: 4 }); // 66 % shows 60 %
    const all = { ...four, projects: [project("Engine", "https://github.com/ada/engine")] };
    expect(completenessOf(all, 1)).toMatchObject({ percent: 100, missing: [] });
  });

  it("ignores blank text, half-filled projects and availability", () => {
    const draft = { ...EMPTY, headline: "   ", projects: [project("Engine", "")], is_available: true };
    const result = completenessOf(draft, 0);
    expect(result.percent).toBe(0);
    expect(result.missing).toEqual(["Headline", "Bio", "Skills", "A project", "GitHub username", "A certificate"]);
  });
});
