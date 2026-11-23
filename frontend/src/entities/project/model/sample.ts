/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-32 #88). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * The dashboard v2 read model for each kind of account. Project 9001 is the
 * one `SAMPLE_PROJECT_UPDATES` (entities/project-update) belongs to, so its
 * latest update shows; the others have none yet. Sample ids (9001+) are not
 * real projects, so screens never link to them.
 */
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
