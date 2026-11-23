/**
 * The new Lead signs the current offer (NN-38, Phase 2 prototype, Aliya's
 * part). Rules: `docs/decisions/phase-2-product-decisions.md`, "Client
 * projects: Lead and member replacement": the team proposes a new Lead → the
 * client approves → the new Lead signs the current offer version.
 *
 * Not in the API yet. Planned read model for
 * `GET /api/projects/{id}/lead-change/`: the offer is the same shape as the
 * start gate's offer (`GET /api/projects/{id}/start/`), and the planned
 * backend adds a co-signature on it rather than a new version.
 */

type Person = { account_id: number; display_name: string };

/** Where the Lead change is: waiting for the client, waiting for the new Lead's signature, or done. */
export type ResignSituation = "awaiting_approval" | "ready_to_sign" | "signed";

/** The version the client already accepted. Its terms don't change when the Lead does. */
export type CurrentOffer = {
  id: number;
  version: number;
  status: "accepted";
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
  decline_reason: null;
};

/** A Team Lead's signature on the offer: the original Lead's, then each replacement's. */
export type LeadSignature = {
  lead: Person;
  kind: "original" | "replacement";
  /** `null` while the signature is still needed. */
  signed_at: string | null;
};

export type LeadResignSnapshot = {
  situation: ResignSituation;
  /** The moment the sample is seen from, so nothing depends on the clock. */
  as_of: string;
  outgoing_lead: Person;
  new_lead: Person;
  client: Person;
  proposed_by: string;
  proposed_at: string;
  /** When the client approved the new Lead; `null` until they do. */
  approved_at: string | null;
  offer: CurrentOffer;
  signatures: LeadSignature[];
  milestones: { approved: number; total: number };
};

/** Who is looking: the new Lead signs; the client (and anyone else) only follows along. */
export type ResignViewer = "new_lead" | "client";

export function resignViewer(viewer: { is_owner: boolean; is_lead: boolean; is_member: boolean }): ResignViewer | null {
  if (viewer.is_owner) return "client";
  // Prototype: anyone on the team sees the screen as the approved new Lead would.
  if (viewer.is_lead || viewer.is_member) return "new_lead";
  return null;
}

/** The new Lead's signature, once given. */
export function replacementSignature(snapshot: Pick<LeadResignSnapshot, "signatures" | "new_lead">): LeadSignature | undefined {
  return snapshot.signatures.find(
    (s) => s.kind === "replacement" && s.lead.account_id === snapshot.new_lead.account_id,
  );
}

export const RESIGN_SITUATION_LABEL: Record<ResignSituation, string> = {
  awaiting_approval: "Not approved yet",
  ready_to_sign: "Ready to sign",
  signed: "Signed",
};
