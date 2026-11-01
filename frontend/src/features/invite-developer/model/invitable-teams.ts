import type { MyProject, ProjectCardData } from "@/entities/project";

/** The projects whose team the viewer leads and that still have open spots, on
 * which this developer isn't the Lead. Team Lead is per project, never a role:
 * a developer's own idea has them as `owner`, a hired Lead as `lead`. */
export function invitableTeams(mine: MyProject[], developerId: number): ProjectCardData[] {
  return mine
    .filter(({ my_role, project }) => my_role !== "member" && project.open_spots > 0 && project.lead?.account_id !== developerId)
    .map(({ project }) => project);
}
