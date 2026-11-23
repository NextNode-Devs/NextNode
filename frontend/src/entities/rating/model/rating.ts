/**
 * Ratings and Team Lead references (Phase 2 prototype, NN-35 #98; stakeholder Q4).
 *
 * After a client project is completed, the client rates the Team Lead and
 * the team, and the Team Lead rates each member (optionally writing a Team
 * Lead reference, shown on the member's portfolio). One rating per rater per
 * ratee per project, 1 to 5 stars.
 *
 * PROTOTYPE: there is no API yet; these are the planned shapes (backend note:
 * a Rating model, only after `Completed`; averages and counts per rater type).
 */

/** Who gave a rating. Averages and counts are kept apart for each. */
export type RaterType = "client" | "lead";

export type RatingStat = {
  /** 1–5, one decimal; `null` when there are no ratings of this kind. */
  average: number | null;
  count: number;
};

/** Planned `GET /api/developers/{id}/ratings/`. */
export type RatingSummary = {
  account_id: number;
  from_clients: RatingStat;
  from_leads: RatingStat;
};

/** Planned `GET /api/developers/{id}/references/`: what Team Leads wrote about a member. */
export type TeamLeadReference = {
  id: number;
  member_account_id: number;
  lead_name: string;
  project_title: string;
  body: string;
  written_at: string;
};

/** Someone (or the team as a whole) the viewer rates on a project's ratings page. */
export type RatingTarget = {
  key: string;
  kind: "lead" | "team" | "member";
  name: string;
  /** `null` for the team as a whole. */
  account_id: number | null;
};

export type RatingValue = { stars: number | null; comment: string };

export const RATING_RULES = { min: 1, max: 5, commentMax: 600 } as const;

export const RATER_LABEL: Record<RaterType, string> = {
  client: "From clients",
  lead: "From Team Leads",
};

/** No ratings of either kind yet. */
export function isNewRatee(summary: RatingSummary): boolean {
  return summary.from_clients.count === 0 && summary.from_leads.count === 0;
}

/** Every rating together, weighted by count; `null` when there are none. */
export function overallAverage(summary: RatingSummary): number | null {
  const stats = [summary.from_clients, summary.from_leads].filter((s) => s.count > 0 && s.average !== null);
  const count = stats.reduce((n, s) => n + s.count, 0);
  if (count === 0) return null;
  const total = stats.reduce((sum, s) => sum + (s.average ?? 0) * s.count, 0);
  return Math.round((total / count) * 10) / 10;
}

export function totalRatings(summary: RatingSummary): number {
  return summary.from_clients.count + summary.from_leads.count;
}

/** "4.5" for a bar's label. */
export function formatStars(average: number): string {
  return average.toFixed(1);
}

/** Per target, why its rating can't be sent; empty when everything is fine. */
export function ratingProblems(targets: readonly RatingTarget[], values: Record<string, RatingValue>): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const target of targets) {
    const value = values[target.key];
    if (!value?.stars || value.stars < RATING_RULES.min || value.stars > RATING_RULES.max) {
      problems[target.key] = `Choose 1 to 5 stars for ${target.name}.`;
    } else if (value.comment.trim().length > RATING_RULES.commentMax) {
      problems[target.key] = `Keep it under ${RATING_RULES.commentMax} characters.`;
    }
  }
  return problems;
}
