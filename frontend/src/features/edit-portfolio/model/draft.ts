import type { Portfolio } from "@/entities/developer";

/** One project row being edited. `key` keeps React rows stable as rows are added and removed. */
export type ProjectDraft = { key: string; title: string; repository_url: string; demo_url: string };

/** The whole form; a save replaces the whole portfolio (`PUT /api/developers/me/portfolio/`). */
export type PortfolioDraft = {
  headline: string;
  bio: string;
  github_username: string;
  skills: string[];
  projects: ProjectDraft[];
  resume_url: string;
  is_available: boolean;
};

/** Field paths are the API's own (`headline`, `projects.0.title`), so its errors land on the right field. */
export type FieldErrors = Record<string, string>;

export function draftFrom(portfolio: Portfolio): PortfolioDraft {
  return {
    headline: portfolio.headline,
    bio: portfolio.bio,
    github_username: portfolio.github_username ?? "",
    skills: portfolio.skills.map((skill) => skill.label),
    projects: portfolio.projects.map((project, index) => ({
      key: `saved-${index}`,
      title: project.title,
      repository_url: project.repository_url,
      demo_url: project.demo_url ?? "",
    })),
    resume_url: portfolio.resume_url ?? "",
    is_available: portfolio.is_available,
  };
}

const orNull = (text: string) => text.trim() || null;

/** The request body. Blank optional links are sent as `null` ("no link"). */
export function toRequestBody(draft: PortfolioDraft) {
  return {
    headline: draft.headline,
    bio: draft.bio,
    github_username: orNull(draft.github_username),
    skills: draft.skills,
    projects: draft.projects.map((project) => ({
      title: project.title,
      repository_url: project.repository_url,
      demo_url: orNull(project.demo_url),
    })),
    resume_url: orNull(draft.resume_url),
    is_available: draft.is_available,
  };
}

/** The API's `fields` (lists of messages) → one message per field. */
export function fieldErrorsFromApi(fields: Record<string, string[]> | undefined): FieldErrors {
  const errors: FieldErrors = {};
  for (const [path, messages] of Object.entries(fields ?? {})) {
    if (messages[0]) errors[path] = messages[0];
  }
  return errors;
}
