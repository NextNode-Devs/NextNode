import type { InviteLink } from "@/entities/invite-link";
import type { Project } from "@/entities/project";

/**
 * What someone opening an invite link sees. The link's own state comes first
 * (an expired or used link says so to everyone), then whether this viewer can
 * join with it. The real version re-checks all of this on the server when the
 * link is accepted.
 */
export type InviteScreenState =
  | "invalid"
  | "expired"
  | "used"
  /** Permission denied: only developers join teams. */
  | "client"
  /** Permission denied: they're already the client, Team Lead or a member. */
  | "on-team"
  | "full"
  | "ready";

export function inviteScreenState(
  link: InviteLink | null,
  project: Project | null,
  viewerRole: "developer" | "client",
): InviteScreenState {
  if (!link || !project) return "invalid";
  if (link.status === "expired") return "expired";
  if (link.status === "used") return "used";
  if (viewerRole === "client") return "client";
  const { is_owner, is_lead, is_member } = project.viewer;
  if (is_owner || is_lead || is_member) return "on-team";
  const { team } = project;
  if (team.status !== "open" || (team.size !== null && team.open_spots === 0)) return "full";
  return "ready";
}

/** Who sent the link: the hired Team Lead, or on a developer's own idea, its creator. */
export const inviterName = (project: Project) => project.lead?.display_name ?? project.owner.display_name;
