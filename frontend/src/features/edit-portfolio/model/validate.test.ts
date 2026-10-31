import { describe, expect, it } from "vitest";

import { toRequestBody, type PortfolioDraft } from "./draft";
import { LINK_HINT, validateDraft } from "./validate";

const REPO = "https://github.com/ada/engine";
const draft = (changes: Partial<PortfolioDraft> = {}): PortfolioDraft => ({
  headline: "Full-stack developer",
  bio: "",
  github_username: "ada",
  skills: ["React"],
  projects: [{ key: "a", title: "Engine", repository_url: REPO, demo_url: "" }],
  resume_url: "",
  is_available: false,
  ...changes,
});
const project = (changes: object) => [{ key: "a", title: "Engine", repository_url: REPO, demo_url: "", ...changes }];

describe("validateDraft (mirrors the backend's portfolio rules)", () => {
  it("accepts a valid portfolio with optional links left blank", () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it.each(["github.com/ada", "ftp://example.com/x", "javascript:alert(1)", "https://localhost", "https://exa mple.com"])(
    "refuses %s as a link, on the field it was typed in",
    (url) => {
      expect(validateDraft(draft({ resume_url: url }))).toEqual({ resume_url: LINK_HINT });
      expect(validateDraft(draft({ projects: project({ demo_url: url }) }))).toEqual({ "projects.0.demo_url": LINK_HINT });
    },
  );

  it("needs a title and a repository link on every project", () => {
    expect(validateDraft(draft({ projects: project({ title: " ", repository_url: "" }) }))).toEqual({
      "projects.0.title": "Enter the project title.",
      "projects.0.repository_url": "Enter the repository link.",
    });
  });

  it("refuses over-long text and too many projects", () => {
    expect(validateDraft(draft({ headline: "h".repeat(121) })).headline).toBe("Use at most 120 characters.");
    expect(validateDraft(draft({ resume_url: `https://example.com/${"a".repeat(200)}` })).resume_url).toBe(
      "Use at most 200 characters.",
    );
    const seven = Array.from({ length: 7 }, (_, i) => ({ key: `${i}`, title: "P", repository_url: REPO, demo_url: "" }));
    expect(validateDraft(draft({ projects: seven })).projects).toBe("Add at most 6 projects.");
  });

  it("needs a headline and at least one skill, and refuses a duplicate skill", () => {
    expect(validateDraft(draft({ headline: "", skills: [] }))).toEqual({
      headline: "Enter your headline.",
      skills: "Add at least one skill.",
    });
    expect(validateDraft(draft({ skills: ["React", "react"] })).skills).toBe("A skill is listed twice.");
  });

  it("sends blank optional links as null and nothing that says verified", () => {
    const body = toRequestBody(draft({ github_username: " " }));
    expect(body).toMatchObject({ github_username: null, resume_url: null, projects: [{ demo_url: null }] });
    expect(JSON.stringify(body).toLowerCase()).not.toContain("verif");
  });
});
