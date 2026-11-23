/**
 * Finishing a client project (Phase 2 prototype, NN-17 #97).
 *
 *   In progress ──(every milestone approved)──▶ Completed
 *   Completed ──(client's final approval + final payment)──▶ Archived
 *
 * Once archived the project is read-only, its conversations are kept but
 * closed, the team is archived, and the project is listed under "Shipped
 * projects" on each team member's portfolio, unless it is confidential.
 *
 * PROTOTYPE: there is no API for this yet. These are the planned shapes
 * (backend note: FinalPayment, project `Completed → Archived`, team
 * `Archived`, portfolio entries). The payment parts are PLANNED (see
 * `entities/payment`, planned-payment.ts). Code ownership after the final
 * payment is "To be defined" (phase-2 decisions, "Legal wording").
 */

/** Planned `GET /api/projects/{id}/closing/`. */
export type ProjectClosing = {
  project_id: number;
  milestones: ClosingMilestone[];
  currency: "CAD";
  /** The accepted offer's total. */
  total_cents: number;
  /** Paid at the start; released to the team when the chosen milestone was approved. */
  deposit_cents: number;
  /** The rest of the total, charged when the client gives final approval. */
  final_payment_cents: number;
  final_approved_at: string | null;
  /** Set together with the final approval: the project and team are archived. */
  archived_at: string | null;
  /**
   * SAMPLE FLAG until NN-41 adds `confidential` to Project: a confidential
   * project never appears in anyone's "Shipped projects".
   */
  confidential: boolean;
};

export type ClosingMilestone = { sequence: number; title: string; approved_at: string | null };

/** Where the project is in finishing: milestones still open, waiting for final approval, or archived. */
export type ClosingStage = "milestones_open" | "awaiting_final_approval" | "archived";

export function closingStage(closing: Pick<ProjectClosing, "milestones" | "archived_at">): ClosingStage {
  if (closing.archived_at) return "archived";
  return closing.milestones.length > 0 && closing.milestones.every((m) => m.approved_at)
    ? "awaiting_final_approval"
    : "milestones_open";
}

export function approvedMilestones(closing: Pick<ProjectClosing, "milestones">): number {
  return closing.milestones.filter((m) => m.approved_at).length;
}

/** What final approval sets in motion, in the order it happens. */
export function finalApprovalSteps(confidential: boolean): string[] {
  return [
    "The client's final payment is charged and they get a receipt.",
    "The project is archived: everything stays readable, but nothing can be changed.",
    "Conversations are kept, read-only. Nobody can send new messages.",
    "The team is archived. Members keep access to the archived project.",
    confidential
      ? "The project is confidential, so it is kept off every portfolio."
      : "The project is listed under \"Shipped projects\" on each team member's portfolio.",
  ];
}
