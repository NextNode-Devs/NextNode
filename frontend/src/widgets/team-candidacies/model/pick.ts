import type { MyTeamCandidacy } from "@/entities/team";

export type Show = "invitations" | "applications";

/**
 * "Invitations" are the ones a developer received. "Applications" are the ones
 * they made, plus everything on the teams they lead (who applied, who they invited).
 * Still-pending items come first; within each group, newest first as the API sends them.
 */
export function pickFor(items: MyTeamCandidacy[], show: Show): MyTeamCandidacy[] {
  const received = (item: MyTeamCandidacy) => item.my_part === "developer" && item.kind === "invitation";
  const shown = items.filter((item) => (show === "invitations" ? received(item) : !received(item)));
  return [...shown].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
}
