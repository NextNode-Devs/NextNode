import type { MyProject, ProjectCardData } from "@/entities/project";

/** The client's own projects that can still take a Team Lead: posted client
 * briefs with no Lead yet (`needs_lead` comes from the API). */
export function invitableProjects(mine: MyProject[]): ProjectCardData[] {
  return mine.filter(({ my_role, project }) => my_role === "owner" && project.needs_lead).map(({ project }) => project);
}
