"use client";

import { UndoIcon } from "lucide-react";
import { useState } from "react";

// Types only: this is a client component, and the payment entity's index also exports server-only code.
import type { PlannedPayment } from "@/entities/payment";
import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  /** Payments still held: refunded in full if the client cancels (from `refundableNow`). */
  refundable: readonly PlannedPayment[];
  /** Payments already released to the team: not refunded. */
  released: readonly PlannedPayment[];
};

function paymentName(payment: PlannedPayment): string {
  return payment.kind === "deposit" ? "Deposit" : `Milestone ${payment.release_milestone}`;
}

/**
 * The client cancels the project and asks for everything still held back,
 * in full, with no fee (Team Lead, 17 Nov 2026). Money already released to
 * the team for approved milestones is not refunded. PROTOTYPE: confirming
 * shows the under-construction toast; nothing is cancelled or refunded.
 */
export function RequestRefundButton({ refundable, released }: Props) {
  const [open, setOpen] = useState(false);
  const refundCents = refundable.reduce((sum, item) => sum + item.amount_cents, 0);

  function confirm() {
    setOpen(false);
    underConstruction("Cancel and refund");
  }

  return (
    <MotionDialog
      open={open}
      onOpenChange={setOpen}
      title="Cancel the project and request a refund?"
      description={
        refundable.length > 0
          ? `Everything still held is refunded in full, with no fee: ${formatMoney(refundCents, "CAD")}.`
          : "Nothing is held right now, so there is nothing to refund."
      }
      trigger={
        <Button type="button" variant="destructive">
          <UndoIcon aria-hidden data-icon="inline-start" />
          Cancel and request a refund
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep the project
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={refundable.length === 0}>
            Request refund
          </Button>
        </>
      }
    >
      <div className="grid gap-3 text-sm">
        <PrototypeBadge label="Planned" />
        {refundable.length > 0 ? (
          <div>
            <p className="font-medium">Refunded</p>
            <ul className="mt-1 space-y-1">
              {refundable.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>{paymentName(item)}</span>
                  <span className="tabular-nums">{formatMoney(item.amount_cents, item.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {released.length > 0 ? (
          <div>
            <p className="font-medium">Not refunded (already approved and released to the team)</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {released.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>{paymentName(item)}</span>
                  <span className="tabular-nums">{formatMoney(item.amount_cents, item.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-muted-foreground">
          The team is told straight away. What happens to work already delivered is to be defined.
        </p>
      </div>
    </MotionDialog>
  );
}
