"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import type { Milestone } from "@/entities/milestone";
import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  milestone: Pick<Milestone, "sequence" | "title">;
  /** The client chose this milestone to release the held deposit (NN-16a, NN-37). */
  releasesDeposit: boolean;
  /** Moves the sample milestone on screen (prototype preview; nothing is saved). */
  onApprove: () => void;
};

/**
 * The client approves a milestone's work (NN-16b, prototype). If it is the
 * milestone they chose to release the deposit, the dialog says so first
 * (planned payment flow, NN-37). Confirming says it is under construction.
 */
export function ApproveMilestoneButton({ milestone, releasesDeposit, onApprove }: Props) {
  const [open, setOpen] = useState(false);

  function confirm() {
    onApprove();
    setOpen(false);
    underConstruction("Approve milestone");
  }

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title={`Approve milestone ${milestone.sequence}?`}
      description={`You confirm that "${milestone.title}" is done. The team moves on to the next milestone.`}
      trigger={
        <Button type="button">
          <CheckIcon aria-hidden data-icon="inline-start" />
          Approve
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button type="button" onClick={confirm}>
            Approve milestone
          </Button>
        </>
      }
    >
      {releasesDeposit ? (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <PrototypeBadge label="Planned" />
          <p>
            This is the milestone you chose to release your deposit. Once you approve it, the deposit goes to the team
            and is no longer refundable.
          </p>
        </div>
      ) : null}
    </MotionDialog>
  );
}
