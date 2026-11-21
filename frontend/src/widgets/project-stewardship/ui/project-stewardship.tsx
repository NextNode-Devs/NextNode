import type { Project } from "@/entities/project";
import { getStewardship } from "@/entities/team";
import { authedServerApi } from "@/shared/api/server-client";

import { StewardshipCard } from "./stewardship-card";

/**
 * The Assistant Lead and the inactivity check (NN-39), for a developer
 * project's Team Lead and members. Client projects and everyone else get
 * nothing here: the server refuses them.
 */
export async function ProjectStewardship({ project }: { project: Project }) {
  if (project.kind !== "developer" || !(project.viewer.is_lead || project.viewer.is_member)) return null;
  const result = await getStewardship(authedServerApi, project.id);
  if (!result.ok && (result.error.code === "FORBIDDEN" || result.error.code === "NOT_FOUND")) return null;
  return (
    <StewardshipCard
      projectId={project.id}
      isLead={project.viewer.is_lead}
      stewardship={result.ok ? result.data : null}
      loadError={result.ok ? null : result.error.message}
    />
  );
}
