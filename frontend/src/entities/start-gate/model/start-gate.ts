/**
 * The project start gate (#6), as `GET /api/projects/{id}/start/` returns it.
 * Amounts are whole CAD cents, and every deposit figure is the server's.
 */
export type OfferStatus = "sent" | "accepted" | "declined";

export type Person = { account_id: number; display_name: string };

export type Offer = {
  id: number;
  version: number;
  status: OfferStatus;
  summary: string;
  total_cents: number;
  deposit_cents: number;
  currency: string;
  start_date: string;
  delivery_date: string;
  signed_by: Person;
  signed_at: string;
  decided_by: Person | null;
  decided_at: string | null;
  decline_reason: string | null;
};

/** #7's deposit status, the same shape `entities/payment` reads from this endpoint. */
export type GateDeposit = {
  status: "none" | "pending" | "completed" | "failed";
  amount_cents: number | null;
  currency: string | null;
  completed_at: string | null;
};

export type GateCondition = { key: string; label: string; met: boolean };

export type NextActor = "lead" | "client" | "stripe" | "nobody";
export type ViewerRole = "client" | "lead" | "member";
export type GateAction = "close_proposal" | "send_offer" | "decide_offer" | "pay_deposit" | "finalize_timeline";

export type StartGate = {
  project_id: number;
  kind: "client" | "developer";
  project_status: string;
  team_status: "open" | "locked" | "active" | "archived";
  conditions: GateCondition[];
  next_actor: NextActor;
  next_step: string;
  started: boolean;
  viewer_role: ViewerRole;
  actions: GateAction[];
  /** Client projects only; `null` on developer ideas. */
  proposed_budget_cents: number | null;
  deposit_percent: number | null;
  /** Newest first. `null` on developer ideas, which never have offers. */
  offers: Offer[] | null;
  deposit: GateDeposit | null;
  /** A developer idea's finalised timeline. */
  timeline: {
    start_date: string;
    delivery_date: string;
    finalised_at: string;
  } | null;
  /** Team members only; never sent to the client. */
  workspace_conversation_id: string | null;
};

export type DepositPreview = {
  total_cents: number;
  deposit_cents: number;
  deposit_percent: number;
  currency: string;
};

export type OfferBody = {
  summary: string;
  total_cents: number;
  start_date: string;
  delivery_date: string;
};

/** The backend's offer limits (`nextnode.domain.start_gate`), mirrored for quick feedback only. */
export const OFFER_LIMITS = {
  summaryMin: 20,
  summary: 2000,
  reason: 500,
} as const;

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  sent: "Waiting for the client",
  accepted: "Accepted",
  declined: "Declined",
};

/** Who acts next, from the viewer's point of view. */
export function nextActorLabel(actor: NextActor, viewer: ViewerRole): string {
  if (actor === "nobody") return "Started";
  if (actor === "stripe") return "Waiting for Stripe";
  if (actor === viewer) return "Your turn";
  return actor === "lead" ? "Team Lead's turn" : "Client's turn";
}
