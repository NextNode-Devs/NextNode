import {
  compareMatches,
  matchesPlannedFilters,
  normalizeSkills,
  sampleProfileGrowth,
  scoreMatch,
  type DeveloperCardData,
  type DeveloperMatch,
  type DirectoryFilters,
} from "@/entities/developer";
import type { Project } from "@/entities/project";

/** Who may open Hire Devs, and whether the team is still recruiting. */
export type HireDevsAccess = "ok" | "not-lead" | "full" | "closed";

/** Only the Team Lead hires developers (#5); the API re-checks every invitation. */
export function hireDevsAccess(project: Project): HireDevsAccess {
  if (!project.viewer.is_lead) return "not-lead";
  if (project.team.status !== "open") return "closed";
  // A size not chosen yet still has room: teams are 5–7 people.
  if (project.team.size !== null && project.team.open_spots === 0) return "full";
  return "ok";
}

export const hireDevsPath = (projectId: number) => `/projects/${projectId}/hire-devs`;

const fold = (text: string) => text.toLocaleLowerCase("en");

/** Search, skills (every one) and availability: what the API filters on. */
function matchesApiFilters(developer: DeveloperCardData, filters: DirectoryFilters): boolean {
  const q = fold(filters.q.trim());
  if (q && !fold(`${developer.display_name} ${developer.headline}`).includes(q)) return false;
  if (filters.available && !developer.is_available) return false;
  const theirs = new Set(developer.skills.map((skill) => fold(skill.label)));
  return normalizeSkills(filters.skills).every((skill) => theirs.has(fold(skill)));
}

/**
 * PROTOTYPE: what the planned `GET /api/projects/{id}/developer-matches/`
 * will return, computed here over sample developers: the shared filters
 * applied, each developer scored against the project's tech stack, best first.
 */
export function rankDevelopers(
  pool: readonly DeveloperCardData[],
  project: Pick<Project, "tech_stack">,
  filters: DirectoryFilters,
): DeveloperMatch[] {
  return pool
    .map((developer) => ({
      developer,
      // Time zone is still a sample value (#102); new talent is the card's own, from the API.
      growth: { ...sampleProfileGrowth(developer.account_id), is_new_talent: developer.is_new_talent },
      match: scoreMatch(project.tech_stack, developer),
    }))
    .filter(({ developer, growth }) => matchesApiFilters(developer, filters) && matchesPlannedFilters(growth, filters))
    .sort(compareMatches);
}
