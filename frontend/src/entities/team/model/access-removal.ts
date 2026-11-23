/**
 * "You no longer have access to this project" (NN-38, Phase 2 prototype,
 * Aliya's part). Whoever leaves or is removed loses access straight away;
 * their work, files and chat history stay with the project
 * (`docs/decisions/phase-2-product-decisions.md`, stakeholder Q2).
 *
 * Not in the API yet. Planned: when someone whose membership is `left` or
 * `removed` opens the project, `GET /api/projects/{id}/` answers `FORBIDDEN`
 * with this record so the screen can say why.
 */

export type AccessRemovalReason = "left" | "removed" | "lead_replaced";

export type AccessRemoval = {
  reason: AccessRemovalReason;
  project: { id: number; title: string };
  /** The viewer's role on the team before access ended. */
  role: "lead" | "member";
  ended_at: string;
  /** Who removed them (`removed`), or the Lead who replaced them (`lead_replaced`). */
  by: string | null;
};

export const ACCESS_REMOVAL_LABEL: Record<AccessRemovalReason, string> = {
  left: "You left",
  removed: "You were removed",
  lead_replaced: "You were replaced as Lead",
};

/** The parts of the project that close, in the order the tabs show them. */
export const CLOSED_TO_FORMER_MEMBERS = [
  "Team chat",
  "Requirement documents",
  "Meetings",
  "Updates",
  "Team",
  "Payments",
] as const;

export function isAccessRemovalReason(value: unknown): value is AccessRemovalReason {
  return value === "left" || value === "removed" || value === "lead_replaced";
}
