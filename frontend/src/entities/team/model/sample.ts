/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-36 #99). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * The open spots themselves are real (the team's size and members); only
 * which of them are junior is sample, since the API has no spot type yet.
 */

/** Until the API stores spot types: one junior spot whenever the team has two or more open. */
export function sampleJuniorCount(openCount: number): number {
  return openCount >= 2 ? 1 : 0;
}
