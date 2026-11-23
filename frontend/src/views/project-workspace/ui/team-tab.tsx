import { UsersIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import { teamViewer } from "@/entities/team";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { TeamChangesPanel } from "@/widgets/team-changes";

const overviewLink = (project: Project) => (
  <Button asChild variant="outline">
    <Link href={`/projects/${project.id}`}>Back to the overview</Link>
  </Button>
);

/**
 * Prototype (NN-38): Lead and member replacement on a client project. The
 * client, the Team Lead and members each see their own part; the sample team
 * is not this project's.
 */
export function TeamTab({ project }: { project: Project }) {
  const viewer = teamViewer(project.viewer);
  if (project.kind !== "client" || !viewer) {
    return (
      <StateCard
        icon={<UsersIcon aria-hidden />}
        title="Team changes are for client projects"
        message="On a developer's own project, the Team Lead and the Assistant Lead run the team from the Overview."
        action={overviewLink(project)}
      />
    );
  }
  return (
    <div className="space-y-6">
      <PrototypeNotice>
        This tab shows a sample team, not this project&apos;s. Leaving, removing, replacing and approving a new Lead
        are under construction and save nothing.
      </PrototypeNotice>
      <TeamChangesPanel projectId={project.id} viewer={viewer} />
    </div>
  );
}
