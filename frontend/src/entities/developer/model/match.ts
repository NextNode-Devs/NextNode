/**
 * Rule-based developer matching for Hire Devs (Phase 2, NN-33 #91; stakeholder Q4).
 *
 * PROTOTYPE: the planned `GET /api/projects/{id}/developer-matches/` computes
 * this on the server from the project's tech stack and each developer's skills
 * and availability. Until then the prototype screen runs the same rule in the
 * browser over sample developers. No AI: the score is only the required skills
 * the developer has, plus availability, and it always shows its reason.
 */
import type { DeveloperCard, Skill } from "./developer";
import type { ProfileGrowth } from "./profile-growth";

export type MatchScore = {
  /** 0–100: one point per required skill the developer has, one for being available. */
  score: number;
  required_count: number;
  matched_skills: Skill[];
  /** Required skills the developer doesn't list: what they could learn. */
  missing_skills: Skill[];
  is_available: boolean;
  /** One plain sentence, e.g. "4 of 5 required skills, available now". */
  reason: string;
};

/** One result in the planned matches response. */
export type DeveloperMatch = {
  developer: DeveloperCard;
  /** Planned profile fields (#102): the time zone. New talent is `developer.is_new_talent`. */
  growth: ProfileGrowth;
  match: MatchScore;
};

const keyOf = (skill: Skill) => skill.key.trim().toLocaleLowerCase("en");

/** "4 of 5 required skills, available now". */
export function matchReason(matched: number, required: number, available: boolean): string {
  const skills =
    required === 0
      ? "No required skills listed"
      : `${matched} of ${required} required ${required === 1 ? "skill" : "skills"}`;
  return `${skills}, ${available ? "available now" : "not available right now"}`;
}

/** Scores one developer against a project's required skills (its tech stack). */
export function scoreMatch(required: Skill[], developer: Pick<DeveloperCard, "skills" | "is_available">): MatchScore {
  const theirs = new Set(developer.skills.map(keyOf));
  // The same skill listed twice on the project counts once.
  const unique = [...new Map(required.map((skill) => [keyOf(skill), skill])).values()];
  const matched = unique.filter((skill) => theirs.has(keyOf(skill)));
  const missing = unique.filter((skill) => !theirs.has(keyOf(skill)));
  const points = matched.length + (developer.is_available ? 1 : 0);
  return {
    score: Math.round((100 * points) / (unique.length + 1)),
    required_count: unique.length,
    matched_skills: matched,
    missing_skills: missing,
    is_available: developer.is_available,
    reason: matchReason(matched.length, unique.length, developer.is_available),
  };
}

/** Best match first: score, then more required skills, then name, so the order is stable. */
export function compareMatches(a: DeveloperMatch, b: DeveloperMatch): number {
  return (
    b.match.score - a.match.score ||
    b.match.matched_skills.length - a.match.matched_skills.length ||
    (a.developer.display_name < b.developer.display_name ? -1 : a.developer.display_name > b.developer.display_name ? 1 : 0)
  );
}
