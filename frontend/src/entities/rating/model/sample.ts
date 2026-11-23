/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-35 #98). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * Stable values for any real developer id, so server and browser renders
 * match: every fourth developer is new (no ratings, no references) to show
 * the "New, no ratings yet" state. The people being rated match the archived
 * clinic booking app sample (entities/project): Ada leads Margaret, Lee and Sam.
 */
import type { RatingSummary, RatingTarget, TeamLeadReference } from "./rating";

export function sampleRatingSummary(accountId: number): RatingSummary {
  if (accountId % 4 === 0) {
    return { account_id: accountId, from_clients: { average: null, count: 0 }, from_leads: { average: null, count: 0 } };
  }
  return {
    account_id: accountId,
    from_clients: { average: 4 + (accountId % 9) / 10, count: 2 + (accountId % 5) },
    // Every third developer has led only, so no Team Lead has rated them yet.
    from_leads: accountId % 3 === 0 ? { average: null, count: 0 } : { average: 3.8 + (accountId % 7) / 10, count: 1 + (accountId % 4) },
  };
}

export function sampleReferences(accountId: number): TeamLeadReference[] {
  if (accountId % 4 === 0 || accountId % 3 === 0) return [];
  return [
    {
      id: accountId * 10 + 1,
      member_account_id: accountId,
      lead_name: "Ada",
      project_title: "Clinic booking app",
      body: "Owned the booking flow end to end, wrote clear pull requests and helped newer teammates get unstuck.",
      written_at: "2027-01-23T15:00:00Z",
    },
    {
      id: accountId * 10 + 2,
      member_account_id: accountId,
      lead_name: "Priya",
      project_title: "Food bank tracker",
      body: "Reliable and calm under deadlines. I'd happily lead a team with them again.",
      written_at: "2026-10-05T15:00:00Z",
    },
  ];
}

/** What the client rates: the Team Lead and the team as a whole. */
export const SAMPLE_CLIENT_TARGETS: RatingTarget[] = [
  { key: "lead", kind: "lead", name: "Ada (Team Lead)", account_id: 9201 },
  { key: "team", kind: "team", name: "The team", account_id: null },
];

/** What the Team Lead rates: each member. */
export const SAMPLE_MEMBER_TARGETS: RatingTarget[] = [
  { key: "m-9202", kind: "member", name: "Margaret", account_id: 9202 },
  { key: "m-9203", kind: "member", name: "Lee", account_id: 9203 },
  { key: "m-9204", kind: "member", name: "Sam", account_id: 9204 },
];

/** Prototype only: the points around rating a tester can switch between. */
export type RatingSampleSituation = "not_completed" | "open" | "already_rated";

export const RATING_SAMPLE_SITUATIONS: { value: RatingSampleSituation; label: string }[] = [
  { value: "not_completed", label: "Project not completed" },
  { value: "open", label: "Ready to rate" },
  { value: "already_rated", label: "Already rated" },
];
