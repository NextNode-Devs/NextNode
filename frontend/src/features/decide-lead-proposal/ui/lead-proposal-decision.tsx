"use client";

import { useState } from "react";

import type { LeadProposal } from "@/entities/team";
import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = { proposal: LeadProposal; currentLead: string };

/** The client approves or declines the team's proposed Lead (NN-38, prototype). */
export function LeadProposalDecision({ proposal, currentLead }: Props) {
  const [open, setOpen] = useState(false);
  const name = proposal.candidate.display_name;

  const approve = () => {
    setOpen(false);
    underConstruction(`Approving ${name} as Team Lead`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <MotionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Approve ${name} as Team Lead?`}
        description={`${name} signs offer version ${proposal.offer_version} next. ${currentLead} stops being the Lead and loses access straight away. The work, files and chat stay with the project.`}
        trigger={<Button size="sm">Approve</Button>}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button onClick={approve}>Approve {name}</Button>
          </>
        }
      />
      <Button variant="outline" size="sm" onClick={() => underConstruction("Declining the proposal")}>
        Decline
      </Button>
    </div>
  );
}
