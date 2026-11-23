/**
 * Unified dashboard v2 (Phase 2, NN-32 #88): the viewer's projects with their
 * role on each, and what needs their attention.
 *
 * PROTOTYPE: planned read model for `GET /api/dashboard/`. Phase 1's
 * `GET /api/projects/mine/` gives `my_role` (owner, lead, member); this adds
 * the Assistant Lead (NN-39), whether the viewer still has access (a member
 * who leaves loses it at once, stakeholder Q2) and the attention list.
 */
import type { ProjectCard } from "./project";

export type ProjectRole = "lead" | "assistant_lead" | "member" | "client";

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  lead: "Team Lead",
  assistant_lead: "Assistant Lead",
  member: "Developer",
  client: "Client",
};

/** Filter order: the roles with the most to do first. */
export const PROJECT_ROLES: readonly ProjectRole[] = ["lead", "assistant_lead", "member", "client"];

export type DashboardProject = {
  project: Pick<ProjectCard, "id" | "kind" | "status" | "title">;
  role: ProjectRole;
  /** `false` once the viewer has left or been removed: listed, but nothing opens. */
  has_access: boolean;
};

export type AttentionKind =
  | "review_milestone"
  | "review_offer"
  | "applicants_waiting"
  | "invitation_waiting"
  | "activity_check";

/** Something waiting on the viewer, with the one action that resolves it. */
export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  project_id: number;
  project_title: string;
  /** The viewer's role on that project; `null` for an invitation to a project they aren't on yet. */
  role: ProjectRole | null;
  text: string;
  action_label: string;
};
