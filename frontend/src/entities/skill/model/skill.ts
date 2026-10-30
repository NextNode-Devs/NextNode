/** A skill as `GET /api/skills/` returns it. The limits mirror the backend's
 * `nextnode.domain.accounts.skills`. */
export type SkillOption = { key: string; label: string };

export const SKILL_MAX_LENGTH = 40;
export const MAX_SKILLS = 20;
export const SKILL_PATTERN = /^[\p{L}\p{N} .+#/-]+$/u;

/** The same normalisation as the backend, so duplicates are caught while typing. */
export function skillKey(label: string): string {
  return label.split(/\s+/).filter(Boolean).join(" ").toLocaleLowerCase("en");
}

export function cleanSkill(label: string): string {
  return label.split(/\s+/).filter(Boolean).join(" ");
}
