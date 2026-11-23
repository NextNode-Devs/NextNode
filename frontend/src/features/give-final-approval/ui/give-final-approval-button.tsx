"use client";

import { BadgeCheckIcon } from "lucide-react";
import { useState } from "react";

import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  finalPaymentCents: number;
  currency: string;
  /** Moves the sample on screen to "archived" (prototype preview; nothing is saved or charged). */
  onApproved: () => void;
};

/**
 * The client's final approval (NN-17, prototype): approves the finished
 * project and pays the final payment (PLANNED). Confirming says it is under
 * construction: nothing is charged and the project is not archived.
 */
export function GiveFinalApprovalButton({ finalPaymentCents, currency, onApproved }: Props) {
  const [open, setOpen] = useState(false);
  const amount = formatMoney(finalPaymentCents, currency);

  function confirm() {
    onApproved();
    setOpen(false);
    underConstruction("Final approval and final payment");
  }

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title="Give final approval?"
      description="You confirm the project is finished. This can't be undone: the project is archived and becomes read-only."
      trigger={
        <Button type="button" className="w-full sm:w-auto">
          <BadgeCheckIcon aria-hidden data-icon="inline-start" />
          Give final approval
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button type="button" onClick={confirm}>
            Approve and pay {amount}
          </Button>
        </>
      }
    >
      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <PrototypeBadge label="Planned" />
        <p>
          Your final payment of <strong>{amount}</strong> is charged to your card and goes to the team. You get a
          receipt.
        </p>
      </div>
    </MotionDialog>
  );
}
