import type { PortfolioDraft } from "./draft";

/** The six things the edit page asks for (NN-34, decision of 21 Nov 2026).
 * "Available for work" is a yes/no switch, never empty, so it isn't counted. */
export const COMPLETENESS_FIELDS = [
  { key: "headline", label: "Headline" },
  { key: "bio", label: "Bio" },
  { key: "skills", label: "Skills" },
  { key: "projects", label: "A project" },
  { key: "github_username", label: "GitHub username" },
  { key: "certificates", label: "A certificate" },
] as const;

export type Completeness = {
  /** Rounded down to a multiple of 10: 4 of 6 is 66 %, shown as 60 %. */
  percent: number;
  filled: number;
  total: number;
  missing: string[];
};

export function completenessOf(
  draft: PortfolioDraft,
  certificateCount: number,
): Completeness {
  const done: Record<(typeof COMPLETENESS_FIELDS)[number]["key"], boolean> = {
    headline: draft.headline.trim() !== "",
    bio: draft.bio.trim() !== "",
    skills: draft.skills.length > 0,
    projects: draft.projects.some(
      (project) =>
        project.title.trim() !== "" && project.repository_url.trim() !== "",
    ),
    github_username: draft.github_username.trim() !== "",
    certificates: certificateCount > 0,
  };
  const total = COMPLETENESS_FIELDS.length;
  const filled = COMPLETENESS_FIELDS.filter(({ key }) => done[key]).length;
  return {
    percent: Math.floor((filled / total) * 10) * 10,
    filled,
    total,
    missing: COMPLETENESS_FIELDS.filter(({ key }) => !done[key]).map(
      ({ label }) => label,
    ),
  };
}
