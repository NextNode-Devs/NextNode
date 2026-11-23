import type { Project } from "@/entities/project";

/**
 * Which escalation route this viewer gets in the workspace (NN-40, Q5).
 * Team members raise an issue with their Team Lead first; the Lead and the
 * client escalate through Contact support. Without a Lead, support is the
 * only route. `null`: not in the workspace, so nothing is offered.
 */
export type HelpRoute =
  | { kind: "raise-with-lead"; leadName: string }
  | { kind: "no-lead" }
  | { kind: "lead" }
  | { kind: "client" };

export function helpRoute(project: Project): HelpRoute | null {
  const { is_owner, is_lead, is_member } = project.viewer;
  if (is_lead) return { kind: "lead" };
  if (is_member) return project.lead ? { kind: "raise-with-lead", leadName: project.lead.display_name } : { kind: "no-lead" };
  if (is_owner) return { kind: "client" };
  return null;
}
