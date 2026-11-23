import { FlagIcon } from "lucide-react";
import Link from "next/link";

import { milestoneViewer, SAMPLE_MILESTONE_PLAN } from "@/entities/milestone";
import type { Project } from "@/entities/project";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { MilestoneReviewPanel } from "@/widgets/milestone-review";

/**
 * Prototype (NN-16b, #95): milestone delivery and review on a client project.
 * The Team Lead submits work, the client approves it or asks for changes,
 * members follow along. The sample milestones are not this project's.
 */
export function MilestonesTab({ project, viewerName }: { project: Project; viewerName: string }) {
  const viewer = milestoneViewer(project.viewer);
  if (project.kind !== "client" || !viewer) {
    return (
      <StateCard
        icon={<FlagIcon aria-hidden />}
        title="Milestones are for client projects"
        message="A client's offer splits the work into milestones. A developer's own project has none; track progress in Updates."
        action={
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}`}>Back to the overview</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <PrototypeNotice>
        This tab shows sample milestones, not this project&apos;s. Submitting, approving and requesting changes show
        on screen so you can try the review loop, but they are under construction and save nothing.
      </PrototypeNotice>
      <MilestoneReviewPanel
        viewer={viewer}
        viewerName={viewerName}
        depositReleaseMilestone={SAMPLE_MILESTONE_PLAN.deposit_release_milestone}
      />
    </div>
  );
}
