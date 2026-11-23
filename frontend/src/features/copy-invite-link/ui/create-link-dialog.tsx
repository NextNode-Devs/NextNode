"use client";

import { LinkIcon } from "lucide-react";
import { useId, useState } from "react";

import { DEFAULT_EXPIRY_HOURS, INVITE_LINK_EXPIRY_OPTIONS } from "@/entities/invite-link";
import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

/**
 * PROTOTYPE: choose how long a new invite link lasts. Creating it is under
 * construction; the dialog shows the choice the real version will offer.
 */
export function CreateLinkDialog({ hasActive }: { hasActive: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(String(DEFAULT_EXPIRY_HOURS));

  const create = () => {
    setOpen(false);
    underConstruction("Create invite link");
  };

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title="Create an invite link"
      description="Send it to the developer you want. It lets one developer join this team, and stops working when it expires."
      trigger={
        <Button variant={hasActive ? "outline" : "default"} size="sm">
          <LinkIcon aria-hidden data-icon="inline-start" />
          {hasActive ? "Create new link" : "Create invite link"}
        </Button>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create}>Create link</Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Link expires after</legend>
        <RadioGroup value={hours} onValueChange={(next) => next && setHours(next)}>
          {INVITE_LINK_EXPIRY_OPTIONS.map((option) => (
            <label
              key={option.hours}
              htmlFor={`${id}-${option.hours}`}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <RadioGroupItem id={`${id}-${option.hours}`} value={String(option.hours)} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      {hasActive ? (
        <p className="text-sm text-muted-foreground">Creating a new link stops the current one working.</p>
      ) : null}
    </MotionDialog>
  );
}
