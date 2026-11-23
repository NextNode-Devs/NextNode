"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  /** The Lead leaving starts the team's proposal for a new Lead. */
  asLead: boolean;
};

/**
 * A member or the Lead leaves a client project's team (NN-38, prototype).
 * Confirms first, because access ends straight away.
 */
export function LeaveTeamButton({ asLead }: Props) {
  const [open, setOpen] = useState(false);

  const leave = () => {
    setOpen(false);
    underConstruction("Leaving the team");
  };

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title={asLead ? "Step down as Team Lead?" : "Leave this team?"}
      description={
        asLead
          ? "The team proposes a new Lead from its members and the client approves them. You lose access to the chat, files and workspace straight away; your work stays with the project."
          : "Everyone is notified and the client is told. You lose access to the chat, files and workspace straight away; your work stays with the project."
      }
      trigger={
        <Button variant="outline" size="sm">
          <LogOutIcon aria-hidden /> {asLead ? "Step down as Lead" : "Leave the team"}
        </Button>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Stay
          </Button>
          <Button variant="destructive" onClick={leave}>
            {asLead ? "Step down" : "Leave the team"}
          </Button>
        </>
      }
    />
  );
}
