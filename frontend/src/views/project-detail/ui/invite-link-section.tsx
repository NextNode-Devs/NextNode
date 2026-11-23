import { sampleInviteLinks } from "@/entities/invite-link";
import type { Project } from "@/entities/project";
import { InviteLinkCard } from "@/features/copy-invite-link";

/**
 * Phase 2 prototype section (NN-26 #90): time-limited invite links, beside the
 * Phase 1 team roster. Only the Team Lead of a team that is still recruiting
 * sees it. Sample links until the API issues real ones.
 */
export function InviteLinkSection({ project, now }: { project: Project; now: string }) {
  const { team } = project;
  const recruiting = team.status === "open" && (team.size === null || team.open_spots > 0);
  if (!project.viewer.is_lead || !recruiting) return null;
  return <InviteLinkCard links={sampleInviteLinks(project.id, now)} now={now} />;
}
