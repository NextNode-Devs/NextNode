import type { ReactNode } from "react";

import { ApplyToJoin } from "@/features/apply-to-join";
import { ApplyToLead } from "@/features/apply-to-lead";
import type { Project, ViewerAction } from "@/entities/project";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * The detail page's action slot (#3's contract with #4 and #5). The API's
 * `viewer_actions` decides which one applies; "Apply to lead" is never offered
 * on a developer idea.
 */
const ACTIONS: Record<ViewerAction, (project: Project) => ReactNode> = {
  apply_to_lead: (project) => (
    <ActionCard title="Lead this project" description="Apply to be its Team Lead. The client picks one Team Lead.">
      <ApplyToLead projectId={project.id} />
    </ActionCard>
  ),
  apply_to_join: (project) => (
    <ActionCard
      title="Join this team"
      description={`${project.team.open_spots} open ${project.team.open_spots === 1 ? "spot" : "spots"}. The Team Lead decides who joins.`}
    >
      <ApplyToJoin projectId={project.id} />
    </ActionCard>
  ),
};

export function PrimaryAction({ project }: { project: Project }) {
  const action = project.viewer_actions.map((name) => ACTIONS[name]).find(Boolean);
  return action ? <>{action(project)}</> : null;
}

function ActionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
