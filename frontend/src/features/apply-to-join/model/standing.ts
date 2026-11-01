import type { MyTeamCandidacy } from "@/entities/team";

/** What stops a developer applying to this project's team: anything still pending
 * (an application or an invitation), or an application they already made. A
 * declined invitation doesn't count: they never asked to join. */
export function standingOn(mine: MyTeamCandidacy[], projectId: number): MyTeamCandidacy | undefined {
  const here = mine.filter((item) => item.project_id === projectId && item.my_part === "developer");
  return here.find((item) => item.status === "pending") ?? here.find((item) => item.kind === "application");
}
