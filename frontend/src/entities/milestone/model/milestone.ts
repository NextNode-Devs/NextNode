/**
 * A milestone on a client project's offer (Phase 2, NN-16a #94; stakeholder Q1).
 *
 * PROTOTYPE: there is no milestone API yet. These types are the planned API
 * shape (snake_case, like the rest of the API), so wiring the screens to the
 * backend later only replaces the sample data. Rules:
 * `docs/decisions/phase-2-product-decisions.md`.
 *
 * Owner: Aliya (#94) extends this slice. Kai (#95) and the payments
 * prototype (#96) build on it.
 */

/** Proposal FR6: `Pending Deposit → In Progress → Under Review → Completed`. */
export type MilestoneStatus = "pending_deposit" | "in_progress" | "under_review" | "completed";

export type Milestone = {
  id: number;
  project_id: number;
  /** 1, 2, 3 … in delivery order. */
  sequence: number;
  title: string;
  description: string;
  /** CAD, whole cents (like every amount in NextNode). */
  amount_cents: number;
  /** Calendar date, `YYYY-MM-DD`. */
  due_date: string;
  status: MilestoneStatus;
  /** When the Team Lead last submitted the work for review (ISO timestamp). */
  submitted_at: string | null;
  /** When the client approved it (ISO timestamp). */
  approved_at: string | null;
};

/** The client may only release the deposit on milestone 1 or 2 (Team Lead, 17 Nov 2026). */
export type DepositReleaseChoice = 1 | 2;

/** The milestone part of an offer version: the schedule plus its deposit terms. */
export type MilestonePlan = {
  project_id: number;
  offer_version: number;
  /** 20 by default; the client and Lead may agree a higher one (stakeholder Q1). */
  deposit_percent: number;
  /** Chosen by the client when accepting the offer; `null` until then. */
  deposit_release_milestone: DepositReleaseChoice | null;
  milestones: Milestone[];
};

export const MILESTONE_RULES = {
  /** Every client-project offer has at least 3, so milestone 1 or 2 is never the last. */
  minPerOffer: 3,
  depositReleaseChoices: [1, 2] as const satisfies readonly DepositReleaseChoice[],
  defaultDepositPercent: 20,
  titleMax: 120,
} as const;

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending_deposit: "Pending deposit",
  in_progress: "In progress",
  under_review: "Under review",
  completed: "Completed",
};

export function milestonesTotalCents(milestones: readonly Pick<Milestone, "amount_cents">[]): number {
  return milestones.reduce((sum, item) => sum + item.amount_cents, 0);
}

export function isDepositReleaseChoice(sequence: number): sequence is DepositReleaseChoice {
  return (MILESTONE_RULES.depositReleaseChoices as readonly number[]).includes(sequence);
}

/**
 * Why a milestone schedule cannot be sent as an offer, in plain words; empty
 * when it can. The backend will enforce the same rules when it exists.
 */
export function milestoneScheduleProblems(
  milestones: readonly Pick<Milestone, "sequence" | "title" | "amount_cents" | "due_date">[],
  offerTotalCents: number,
): string[] {
  const problems: string[] = [];
  if (milestones.length < MILESTONE_RULES.minPerOffer) {
    problems.push(`An offer needs at least ${MILESTONE_RULES.minPerOffer} milestones.`);
  }
  const ordered = [...milestones].sort((a, b) => a.sequence - b.sequence);
  if (ordered.some((item, index) => item.sequence !== index + 1)) {
    problems.push("Milestones must be numbered 1, 2, 3 … without gaps.");
  }
  if (ordered.some((item) => !item.title.trim())) {
    problems.push("Every milestone needs a title.");
  }
  if (ordered.some((item) => item.amount_cents <= 0)) {
    problems.push("Every milestone needs an amount above zero.");
  }
  if (ordered.length > 0 && milestonesTotalCents(ordered) !== offerTotalCents) {
    problems.push("The milestone amounts must add up to the offer total.");
  }
  if (ordered.some((item, index) => index > 0 && item.due_date <= ordered[index - 1].due_date)) {
    problems.push("Each milestone must be due after the one before it.");
  }
  return problems;
}
