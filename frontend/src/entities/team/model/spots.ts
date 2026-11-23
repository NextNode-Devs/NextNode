/**
 * Junior spots (Phase 2 prototype, NN-36 #99; stakeholder Q4).
 *
 * The Team Lead marks some of the team's open spots as junior: meant for a
 * developer new to NextNode. "New talent" (NN-34) is a developer whose
 * account is at most 15 days old; Hire Devs (NN-33) and the directory filter
 * on it with `?new_talent=true`. Team size is still 5 to 7, Team Lead
 * included: a junior spot is one of those open spots, never an extra one.
 *
 * PROTOTYPE: there is no API yet (backend note: a spot type on the team).
 */

export type SpotType = "standard" | "junior";

/** One open spot on the team, numbered from 1 (planned `GET /api/teams/{id}/spots/`). */
export type OpenSpot = { number: number; type: SpotType };

/** The team's open spots, the first `juniorCount` of them junior. */
export function spotsWithJunior(openCount: number, juniorCount: number): OpenSpot[] {
  const junior = clampJunior(openCount, juniorCount);
  return Array.from({ length: Math.max(0, openCount) }, (_, i) => ({
    number: i + 1,
    type: i < junior ? "junior" : "standard",
  }));
}

/** A junior count can't be negative or more than the open spots. */
export function clampJunior(openCount: number, juniorCount: number): number {
  return Math.min(Math.max(0, juniorCount), Math.max(0, openCount));
}

export function juniorCount(spots: readonly OpenSpot[]): number {
  return spots.filter((s) => s.type === "junior").length;
}

/** "1 of 3 open spots is for junior developers." */
export function juniorSpotsLine(spots: readonly OpenSpot[]): string {
  const junior = juniorCount(spots);
  const open = spots.length;
  if (open === 0) return "No open spots.";
  if (junior === 0) return open === 1 ? "The open spot isn't marked junior." : `None of the ${open} open spots are marked junior.`;
  if (open === 1) return "The open spot is for a junior developer.";
  return `${junior} of ${open} open spots ${junior === 1 ? "is" : "are"} for junior developers.`;
}

/** Hire Devs (NN-33) showing new talent only. */
export function newTalentHireDevsHref(projectId: number): string {
  return `/projects/${projectId}/hire-devs?new_talent=true`;
}

/** The developer directory (NN-34) showing new talent only. */
export const NEW_TALENT_DIRECTORY_HREF = "/developers?new_talent=true";
