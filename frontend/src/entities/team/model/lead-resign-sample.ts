/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-38). Only prototype screens may import
 * this; never a Phase 1 screen. The same sample team as
 * `replacement-sample.ts` (Ada Okafor leads; the team proposed Marco Ruiz),
 * one step further on. Fixed dates keep server and browser renders equal.
 */
import type { AccessRemoval, AccessRemovalReason } from "./access-removal";
import type { CurrentOffer, LeadResignSnapshot, LeadSignature, ResignSituation } from "./lead-resign";

const AS_OF = "2026-11-21T15:00:00Z";

const ADA = { account_id: 9101, display_name: "Ada Okafor (sample)" };
const MARCO = { account_id: 9102, display_name: "Marco Ruiz (sample)" };
const CLIENT = { account_id: 9001, display_name: "Grace Lee (sample)" };

const OFFER: CurrentOffer = {
  id: 9301,
  version: 3,
  status: "accepted",
  summary:
    "Clinic booking site: patient sign-up, appointment calendar, reminders by email and an admin view for staff.\nThree milestones: design, booking flow, launch.",
  total_cents: 480_000,
  deposit_cents: 96_000,
  currency: "CAD",
  start_date: "2026-11-02",
  delivery_date: "2027-01-29",
  signed_by: ADA,
  signed_at: "2026-10-29T16:20:00Z",
  decided_by: CLIENT,
  decided_at: "2026-10-30T14:05:00Z",
  decline_reason: null,
};

const ORIGINAL: LeadSignature = { lead: ADA, kind: "original", signed_at: OFFER.signed_at };

const BASE = {
  as_of: AS_OF,
  outgoing_lead: ADA,
  new_lead: MARCO,
  client: CLIENT,
  proposed_by: "Sofia Alves (sample)",
  proposed_at: "2026-11-21T10:15:00Z",
  offer: OFFER,
  milestones: { approved: 1, total: 3 },
};

const SNAPSHOTS: Record<ResignSituation, LeadResignSnapshot> = {
  awaiting_approval: {
    ...BASE,
    situation: "awaiting_approval",
    approved_at: null,
    signatures: [ORIGINAL],
  },
  ready_to_sign: {
    ...BASE,
    situation: "ready_to_sign",
    approved_at: "2026-11-21T13:30:00Z",
    signatures: [ORIGINAL, { lead: MARCO, kind: "replacement", signed_at: null }],
  },
  signed: {
    ...BASE,
    situation: "signed",
    approved_at: "2026-11-21T13:30:00Z",
    signatures: [ORIGINAL, { lead: MARCO, kind: "replacement", signed_at: "2026-11-21T14:20:00Z" }],
  },
};

export const SAMPLE_RESIGN_SITUATIONS: ResignSituation[] = ["awaiting_approval", "ready_to_sign", "signed"];

export function sampleLeadResign(situation: ResignSituation): LeadResignSnapshot {
  return SNAPSHOTS[situation];
}

const PROJECT = { id: 9005, title: "Event ticketing (sample)" };

const REMOVALS: Record<AccessRemovalReason, AccessRemoval> = {
  left: { reason: "left", project: PROJECT, role: "member", ended_at: "2026-11-20T15:05:00Z", by: null },
  removed: { reason: "removed", project: PROJECT, role: "member", ended_at: "2026-11-20T15:05:00Z", by: ADA.display_name },
  lead_replaced: {
    reason: "lead_replaced",
    project: PROJECT,
    role: "lead",
    ended_at: "2026-11-21T13:30:00Z",
    by: MARCO.display_name,
  },
};

export const SAMPLE_ACCESS_REMOVAL_REASONS: AccessRemovalReason[] = ["left", "removed", "lead_replaced"];

export function sampleAccessRemoval(reason: AccessRemovalReason): AccessRemoval {
  return REMOVALS[reason];
}
