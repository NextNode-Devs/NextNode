import type { Project } from "@/entities/project";
import { getTeam, TeamLiveRefresh } from "@/entities/team";
import { authedServerApi } from "@/shared/api/server-client";
import { isAuthConfigured } from "@/shared/config/env.public";

import { TeamRosterCard } from "./team-roster-card";

/** The team profile on a project's page, kept current as decisions arrive live. */
export async function TeamRoster({ project }: { project: Project }) {
  const result = await getTeam(authedServerApi, project.id);
  return (
    <>
      {isAuthConfigured() ? <TeamLiveRefresh projectId={project.id} /> : null}
      <TeamRosterCard
        project={project}
        team={result.ok ? result.data : null}
        loadError={result.ok ? null : result.error.message}
      />
    </>
  );
}
