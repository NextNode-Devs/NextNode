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
      <NextInFlow project={project} />
    </div>
  );
}

/** NN-38 (Aliya): the screens after the Team tab: the new Lead signs, and access-lost. */
function NextInFlow({ project }: { project: Project }) {
  const base = `/projects/${project.id}`;
  return (
    <section aria-labelledby="next-in-flow" className="space-y-2 rounded-xl border p-4">
      <h2 id="next-in-flow" className="text-sm font-medium">
        Next in this flow
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="sm" variant="outline">
          <Link href={`${base}/team/sign-offer`}>The new Lead signs the offer</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`${base}/no-access`}>What someone who left sees</Link>
        </Button>
      </div>
    </section>
  );
}
