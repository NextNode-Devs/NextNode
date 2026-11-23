"use client";

import { useId, useState } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { Label } from "@/shared/ui/shadcn/label";
import { Textarea } from "@/shared/ui/shadcn/textarea";

type Props = { name: string };

/** The Team Lead removes a member from a client project's team (NN-38, prototype). */
export function RemoveMemberButton({ name }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const remove = () => {
    setOpen(false);
    setReason("");
    underConstruction(`Removing ${name}`);
  };

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title={`Remove ${name}?`}
      description="They lose access to the chat, files and workspace straight away. Their work stays with the project. Everyone is notified and the client is told."
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Remove ${name}`}>
          Remove
        </Button>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep them
          </Button>
          <Button variant="destructive" onClick={remove}>
            Remove
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-reason`}>Reason (optional)</Label>
        <Textarea
          id={`${id}-reason`}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Shared with {name} and the team.
        </p>
      </div>
    </MotionDialog>
  );
}
