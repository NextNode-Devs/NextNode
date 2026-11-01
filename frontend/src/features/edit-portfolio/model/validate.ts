import { PORTFOLIO_LIMITS as L } from "@/entities/developer";
import { MAX_SKILLS, SKILL_MAX_LENGTH, SKILL_PATTERN, skillKey } from "@/entities/skill";

import type { FieldErrors, PortfolioDraft } from "./draft";

const GITHUB_USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const LINK_HINT = "Enter a full link starting with https://, e.g. https://example.com.";

/** The backend's link rule: http(s), a host with a dot, no spaces, at most 200 characters. */
export function linkProblem(value: string, label: string, required: boolean): string | null {
  const text = value.trim();
  if (!text) return required ? `Enter the ${label}.` : null;
  if (text.length > L.url) return `Use at most ${L.url} characters.`;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || /\s/.test(text)) {
      return LINK_HINT;
    }
  } catch {
    return LINK_HINT;
  }
  return null;
}

function textProblem(value: string, label: string, max: number, required: boolean): string | null {
  const text = value.trim();
  if (required && !text) return `Enter ${label}.`;
  if (text.length > max) return `Use at most ${max} characters.`;
  return null;
}

function skillsProblem(skills: string[]): string | null {
  if (!skills.length) return "Add at least one skill.";
  if (skills.length > MAX_SKILLS) return `Add at most ${MAX_SKILLS} skills.`;
  if (skills.some((s) => s.length > SKILL_MAX_LENGTH || !SKILL_PATTERN.test(s))) {
    return "Skills can use letters, numbers, spaces and + # . - / only, up to 40 characters each.";
  }
  if (new Set(skills.map(skillKey)).size !== skills.length) return "A skill is listed twice.";
  return null;
}

/**
 * Mirrors `nextnode.domain.accounts.Portfolio` so most mistakes show before
 * saving. The backend stays the authority; its field errors are shown too.
 */
export function validateDraft(draft: PortfolioDraft): FieldErrors {
  const errors: FieldErrors = {};
  const set = (field: string, problem: string | null) => {
    if (problem) errors[field] = problem;
  };

  set("headline", textProblem(draft.headline, "your headline", L.headline, true));
  set("bio", textProblem(draft.bio, "your bio", L.bio, false));
  const username = draft.github_username.trim().replace(/^@/, "");
  if (username && !GITHUB_USERNAME.test(username)) errors.github_username = "Use 1-39 letters, numbers or single hyphens.";
  set("skills", skillsProblem(draft.skills));
  if (draft.projects.length > L.projects) errors.projects = `Add at most ${L.projects} projects.`;
  draft.projects.forEach((project, i) => {
    set(`projects.${i}.title`, textProblem(project.title, "the project title", L.projectTitle, true));
    set(`projects.${i}.repository_url`, linkProblem(project.repository_url, "repository link", true));
    set(`projects.${i}.demo_url`, linkProblem(project.demo_url, "live demo link", false));
  });
  set("resume_url", linkProblem(draft.resume_url, "resume link", false));
  return errors;
}
