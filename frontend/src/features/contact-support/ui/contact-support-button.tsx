"use client";

import { LifeBuoyIcon } from "lucide-react";
import { useState } from "react";

import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  /** `compact` shows only the icon on phones (the app header). */
  variant?: "default" | "compact";
};

/**
 * "Contact support" (NN-40, stakeholder Q5). Disputes are handled by the
 * project's Team Lead first; this is the escalation route. Phase 2 shows a
 * prototype message: no support desk exists yet and nothing is sent.
 */
export function ContactSupportButton({ variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const compact = variant === "compact";

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title="Contact support"
      description="NextNode is a prototype. Support is not available yet, so nothing is sent from here."
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={compact ? "Contact support" : undefined}
        >
          <LifeBuoyIcon aria-hidden data-icon="inline-start" />
          <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
            {compact ? "Support" : "Contact support"}
          </span>
        </Button>
      }
      footer={
        <Button type="button" onClick={() => setOpen(false)}>
          Got it
        </Button>
      }
    >
      <div className="grid gap-3 text-sm">
        <PrototypeBadge />
        <p>
          Disagreements inside a project go to the project&apos;s Team Lead first. Support is for
          issues that need to be escalated beyond the team.
        </p>
      </div>
    </MotionDialog>
  );
}
