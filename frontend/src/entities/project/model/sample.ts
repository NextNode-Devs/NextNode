/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-32 #88). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * The dashboard v2 read model for each kind of account. Project 9001 is the
 * one `SAMPLE_PROJECT_UPDATES` (entities/project-update) belongs to, so its
 * latest update shows; the others have none yet. Sample ids (9001+) are not
 * real projects, so screens never link to them.
 */
import type { ProjectClosing } from "./closing";
import type { AttentionItem, DashboardProject } from "./dashboard";

export type SampleDashboard = { projects: DashboardProject[]; attention: AttentionItem[] };

const CLINIC = { id: 9001, kind: "client", status: "InProgress", title: "Clinic booking app" } as const;

const DEVELOPER: SampleDashboard = {
  projects: [
    { project: CLINIC, role: "lead", has_access: true },
    { project: { id: 9002, kind: "developer", status: "InProgress", title: "Campus marketplace" }, role: "assistant_lead", has_access: true },
    { project: { id: 9003, kind: "client", status: "Assigned", title: "Food bank tracker" }, role: "member", has_access: true },
    { project: { id: 9004, kind: "developer", status: "Posted", title: "Study group finder" }, role: "lead", has_access: true },
    // Left the team: listed so the history makes sense, but nothing opens (stakeholder Q2).
    { project: { id: 9005, kind: "client", status: "InProgress", title: "Event ticketing" }, role: "member", has_access: false },
  ],
  attention: [
    {
      id: "a1",
      kind: "applicants_waiting",
      project_id: 9001,
      project_title: CLINIC.title,
      role: "lead",
      text: "2 developers asked to join your team.",
      action_label: "Review applications",
    },
    {
      id: "a2",
      kind: "activity_check",
      project_id: 9002,
      project_title: "Campus marketplace",
      role: "assistant_lead",
      text: "Is this project still active? Confirm within 7 days or it closes.",
      action_label: "Confirm it's active",
    },
    {
      id: "a3",
      kind: "invitation_waiting",
      project_id: 9008,
      project_title: "Pet adoption portal",
      role: null,
      text: "Grace invited you to lead this project.",
      action_label: "See the invitation",
    },
  ],
};

const CLIENT: SampleDashboard = {
  projects: [
    { project: CLINIC, role: "client", has_access: true },
    { project: { id: 9006, kind: "client", status: "Posted", title: "Bakery ordering site" }, role: "client", has_access: true },
    { project: { id: 9007, kind: "client", status: "OfferSent", title: "Inventory dashboard" }, role: "client", has_access: true },
  ],
  attention: [
    {
      id: "c1",
      kind: "review_milestone",
      project_id: 9001,
      project_title: CLINIC.title,
      role: "client",
      text: "Milestone 2 is ready for your review.",
      action_label: "Review milestone",
    },
    {
      id: "c2",
      kind: "applicants_waiting",
      project_id: 9006,
      project_title: "Bakery ordering site",
      role: "client",
      text: "3 developers applied to lead this project.",
      action_label: "See applicants",
    },
    {
      id: "c3",
      kind: "review_offer",
      project_id: 9007,
      project_title: "Inventory dashboard",
      role: "client",
      text: "Your Team Lead sent a revised offer.",
      action_label: "Review offer",
    },
  ],
};

export function sampleDashboard(accountRole: "developer" | "client"): SampleDashboard {
  return accountRole === "client" ? CLIENT : DEVELOPER;
}

/* ---------- Finishing a project (NN-17 #97) ---------- */

/** Prototype only: the points in finishing a project a tester can switch between. */
export type ClosingSampleSituation = "milestones_open" | "awaiting_final_approval" | "archived";

export const CLOSING_SAMPLE_SITUATIONS: { value: ClosingSampleSituation; label: string }[] = [
  { value: "milestones_open", label: "Milestones still open" },
  { value: "awaiting_final_approval", label: "Ready for final approval" },
  { value: "archived", label: "Approved and archived" },
];

const CLOSING_MILESTONES = [
  { sequence: 1, title: "Designs and project setup", approved_at: "2026-12-04T14:05:00Z" },
  { sequence: 2, title: "Accounts and booking flow", approved_at: "2026-12-18T21:00:00Z" },
  { sequence: 3, title: "Payments and notifications", approved_at: "2027-01-07T21:00:00Z" },
  { sequence: 4, title: "Launch and handover", approved_at: "2027-01-21T21:00:00Z" },
];

/**
 * The clinic booking app (CAD 6,000, 20 % deposit), matching the planned
 * payments in `entities/payment`. `confidential` is a sample flag (NN-41).
 */
export function sampleClosing(situation: ClosingSampleSituation, projectId: number, confidential = false): ProjectClosing {
  const base: ProjectClosing = {
    project_id: projectId,
    milestones: CLOSING_MILESTONES,
    currency: "CAD",
    total_cents: 600_000,
    deposit_cents: 120_000,
    final_payment_cents: 480_000,
    final_approved_at: null,
    archived_at: null,
    confidential,
  };
  switch (situation) {
    case "milestones_open":
      return {
        ...base,
        milestones: CLOSING_MILESTONES.map((m) => (m.sequence >= 3 ? { ...m, approved_at: null } : m)),
      };
    case "archived":
      return { ...base, final_approved_at: "2027-01-22T16:30:00Z", archived_at: "2027-01-22T16:30:00Z" };
    case "awaiting_final_approval":
    default:
      return base;
  }
}

/** One message in an archived conversation (read-only preview). */
export type ArchivedMessage = { id: number; author_name: string; body: string; sent_at: string };

export type ArchivedConversation = {
  id: string;
  title: string;
  /** Who was in it, in words: "Client and Team Lead", "Team only". */
  audience: string;
  messages: ArchivedMessage[];
};

/** Prototype only: the archived project's conversations, kept read-only. */
export const SAMPLE_ARCHIVED_CONVERSATIONS: ArchivedConversation[] = [
  {
    id: "client-lead",
    title: "Client and Team Lead",
    audience: "Grace (client) and Ada (Team Lead)",
    messages: [
      { id: 1, author_name: "Ada", body: "Launch is done and the handover notes are in Documents.", sent_at: "2027-01-21T20:10:00Z" },
      { id: 2, author_name: "Grace", body: "Thank you all. Approving everything now.", sent_at: "2027-01-22T16:25:00Z" },
    ],
  },
  {
    id: "team",
    title: "Team chat",
    audience: "The team (the client is not part of it)",
    messages: [
      { id: 3, author_name: "Margaret", body: "Production deploy is green.", sent_at: "2027-01-21T18:40:00Z" },
      { id: 4, author_name: "Lee", body: "Great working with everyone!", sent_at: "2027-01-22T17:05:00Z" },
    ],
  },
];
