/**
 * Rule-based developer matching (NN-33, Phase 2 prototype). Rules:
 * `docs/decisions/phase-2-product-decisions.md`, "Matching": the score is the
 * project's required skills the developer has, plus availability, and it
 * always shows its reason. Suggestions only; the Lead chooses. The planned
 * backend computes the same score on the server; AI matching is future work.
 */
import type { Skill } from "./developer";

/** How many suggestions the panel shows. */
export const SUGGESTION_LIMIT = 5;

export type DeveloperMatch = {
  /** 0–100: (required skills they have + 1 if available) / (required skills + 1). */
  score: number;
  matched: Skill[];
  missing: Skill[];
  required: number;
  available: boolean;
  /** Always shown with the score, e.g. "4 of 5 required skills, available now". */
  reason: string;
};

type Matchable = { skills: Skill[]; is_available: boolean };

const keyOf = (skill: Skill) => skill.key.trim().toLocaleLowerCase("en");

export function matchDeveloper(required: Skill[], developer: Matchable): DeveloperMatch {
  const has = new Set(developer.skills.map(keyOf));
  const unique = [...new Map(required.map((skill) => [keyOf(skill), skill])).values()];
  const matched = unique.filter((skill) => has.has(keyOf(skill)));
  const missing = unique.filter((skill) => !has.has(keyOf(skill)));
  const available = developer.is_available;
  const score = Math.round((100 * (matched.length + (available ? 1 : 0))) / (unique.length + 1));
  const skills = `${matched.length} of ${unique.length} required ${unique.length === 1 ? "skill" : "skills"}`;
  return {
    score,
    matched,
    missing,
    required: unique.length,
    available,
    reason: `${skills}, ${available ? "available now" : "not available right now"}`,
  };
}

/**
 * The best matches, highest score first: only developers with at least one
 * required skill, never anyone in `exclude` (the team, the viewer).
 */
export function suggestDevelopers<T extends Matchable & { account_id: number; display_name: string }>(
  required: Skill[],
  developers: T[],
  exclude: Iterable<number> = [],
  limit = SUGGESTION_LIMIT,
): { developer: T; match: DeveloperMatch }[] {
  const skip = new Set(exclude);
  return developers
    .filter((developer) => !skip.has(developer.account_id))
    .map((developer) => ({ developer, match: matchDeveloper(required, developer) }))
    .filter(({ match }) => match.matched.length > 0)
    .sort(
      (a, b) =>
        b.match.score - a.match.score ||
        b.match.matched.length - a.match.matched.length ||
        a.developer.display_name.localeCompare(b.developer.display_name, "en"),
    )
    .slice(0, limit);
}
