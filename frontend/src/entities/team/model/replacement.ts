/**
 * Lead and member replacement on client projects (NN-38, Phase 2 prototype).
 * Rules: `docs/decisions/phase-2-product-decisions.md`, "Client projects: Lead
 * and member replacement". Not in the API yet: the planned backend adds
 * membership `left` / `removed` states, a co-signature on the offer, removal
 * from conversations and an inactivity job.
 */

/** Days without a word from the Lead before the team may propose a new one. */
export const LEAD_UNRESPONSIVE_DAYS = 3;

/** A seat on the team. Whoever leaves or is removed loses access straight away. */
export type SeatState = "active" | "left" | "removed";

export type TeamSeat = {
  account_id: number;
  display_name: string;
  role: "lead" | "member";
  state: SeatState;
  skills: string[];
  joined_at: string;
  /** When they left or were removed; null while active. */
  ended_at: string | null;
};

/** Someone the Lead can pick to fill an open spot: an applicant, or a developer they invited. */
export type ReplacementCandidate = {
  account_id: number;
  display_name: string;
  source: "applicant" | "invited";
  headline: string;
  skills: string[];
  at: string;
};

/** The team's proposal for a new Lead. Only the client approves it. */
export type LeadProposal = {
  candidate: { account_id: number; display_name: string };
  proposed_by: string;
  proposed_at: string;
  client_decision: "pending" | "approved" | "declined";
  /** The offer the new Lead signs once the client approves (NN-38, Aliya's screen). */
  offer_version: number;
};

export type TeamChangeKind = "joined" | "left" | "removed" | "lead_quiet" | "lead_proposed" | "lead_approved";

export type TeamChange = {
  id: number;
  kind: TeamChangeKind;
  at: string;
  text: string;
};

/** The situations the prototype can show. */
export type TeamSituation = "steady" | "member_left" | "lead_unresponsive" | "lead_proposed";

export type TeamChangesSnapshot = {
  situation: TeamSituation;
  /** The moment the sample is seen from, so durations never depend on the clock. */
  as_of: string;
  team_size: number;
  seats: TeamSeat[];
  candidates: ReplacementCandidate[];
  lead_last_active_at: string;
  proposal: LeadProposal | null;
  history: TeamChange[];
};

/** Who is looking at the Team tab. Anyone else is outside the project. */
export type TeamViewer = "client" | "lead" | "member";

export function teamViewer(viewer: { is_owner: boolean; is_lead: boolean; is_member: boolean }): TeamViewer | null {
  if (viewer.is_owner) return "client";
  if (viewer.is_lead) return "lead";
  if (viewer.is_member) return "member";
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two moments (0 when either is invalid or the order is wrong). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.floor((to - from) / DAY_MS);
}

/** The Lead has said nothing in the project for `LEAD_UNRESPONSIVE_DAYS` days or more. */
export function isLeadUnresponsive(lastActiveIso: string, nowIso: string): boolean {
  return daysBetween(lastActiveIso, nowIso) >= LEAD_UNRESPONSIVE_DAYS;
}

export const activeSeats = (seats: TeamSeat[]) => seats.filter((seat) => seat.state === "active");

/** Spots to fill: the team size minus everyone still on it. */
export function openSpots(snapshot: Pick<TeamChangesSnapshot, "team_size" | "seats">): number {
  return Math.max(0, snapshot.team_size - activeSeats(snapshot.seats).length);
}

export const SEAT_STATE_LABEL: Record<SeatState, string> = {
  active: "On the team",
  left: "Left",
  removed: "Removed",
};

export const SITUATION_LABEL: Record<TeamSituation, string> = {
  steady: "Everyone on board",
  member_left: "A member left",
  lead_unresponsive: "Lead not responding",
  lead_proposed: "New Lead proposed",
};
