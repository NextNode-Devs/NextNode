"use client";

import { UndoIcon } from "lucide-react";
import { useState } from "react";

import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

/** One held payment and what the client gets back for it (worked out on the server side). */
export type RefundLine = {
  id: number;
  label: string;
  amount_cents: number;
  /** Stripe's processing fee on that charge; Stripe keeps it on a refund. */
  fee_cents: number;
  refund_cents: number;
};

type Props = { lines: readonly RefundLine[] };

const cad = (cents: number) => formatMoney(cents, "CAD");

/**
 * The client cancels the project and asks for the held deposit back, minus
 * Stripe's processing fee (Team Lead, 17 Nov 2026). Once the deposit has been
 * released to the team there is nothing to refund. PROTOTYPE: confirming
 * shows the under-construction toast; nothing is cancelled or refunded.
 */
export function RequestRefundButton({ lines }: Props) {
  const [open, setOpen] = useState(false);
  const total = lines.reduce((sum, line) => sum + line.refund_cents, 0);

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
        lines.length > 0
          ? `You get ${cad(total)} back. Stripe keeps its processing fee, so that part is not refunded.`
          : "Your deposit has already been released to the team, so there is nothing to refund."
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
          <Button type="button" variant="destructive" onClick={confirm} disabled={lines.length === 0}>
            Request refund
          </Button>
        </>
      }
    >
      <div className="grid gap-3 text-sm">
        <PrototypeBadge label="Planned" />
        {lines.map((line) => (
          <dl key={line.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt>{line.label}</dt>
            <dd className="text-right tabular-nums">{cad(line.amount_cents)}</dd>
            <dt className="text-muted-foreground">Stripe processing fee (not refunded)</dt>
            <dd className="text-right text-muted-foreground tabular-nums">−{cad(line.fee_cents)}</dd>
            <dt className="font-medium">You get back</dt>
            <dd className="text-right font-medium tabular-nums">{cad(line.refund_cents)}</dd>
          </dl>
        ))}
        <p className="text-muted-foreground">
          The team is told straight away. What happens to work already delivered is to be defined.
        </p>
      </div>
    </MotionDialog>
  );
}
