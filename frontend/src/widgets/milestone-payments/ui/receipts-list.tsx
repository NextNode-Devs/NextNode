"use client";

import { DownloadIcon, ReceiptTextIcon } from "lucide-react";
import { useState } from "react";

import type { PlannedPayment, PlannedReceipt } from "@/entities/payment";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Paid = PlannedPayment & { receipt: PlannedReceipt };

/** A receipt for every payment the client made (stakeholder Q5: needed for taxes). */
export function ReceiptsList({ payments }: { payments: readonly PlannedPayment[] }) {
  const paid = payments.filter((item): item is Paid => item.receipt !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Receipts</h2>
        </CardTitle>
        <CardDescription>One for every payment you make.</CardDescription>
      </CardHeader>
      <CardContent>
        {paid.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet. Your first receipt appears here after you pay the deposit.</p>
        ) : (
          <ul className="divide-y">
            {paid.map((item) => (
              <ReceiptRow key={item.id} payment={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReceiptRow({ payment }: { payment: Paid }) {
  const [open, setOpen] = useState(false);
  const { receipt } = payment;
  const amount = formatMoney(payment.amount_cents, payment.currency);
  const issued = formatCalendarDate(receipt.issued_at.slice(0, 10));

  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{receipt.description}</p>
        <p className="text-sm text-muted-foreground">
          {receipt.number} · {issued} · <span className="tabular-nums">{amount}</span>
        </p>
      </div>
      <MotionDialog
        open={open}
        onOpenChange={setOpen}
        title={`Receipt ${receipt.number}`}
        description="Sample receipt. NextNode does not issue receipts yet."
        trigger={
          <Button type="button" variant="outline" size="sm" aria-label={`View receipt ${receipt.number}`}>
            <ReceiptTextIcon aria-hidden data-icon="inline-start" />
            View
          </Button>
        }
        footer={
          <Button type="button" onClick={() => underConstruction("Download receipt")}>
            <DownloadIcon aria-hidden data-icon="inline-start" />
            Download PDF
          </Button>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">For</dt>
          <dd>{receipt.description}</dd>
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="tabular-nums">{amount}</dd>
          <dt className="text-muted-foreground">Paid</dt>
          <dd>{issued}</dd>
          <dt className="text-muted-foreground">Method</dt>
          <dd>{receipt.method_label}</dd>
          <dt className="text-muted-foreground">NextNode fee</dt>
          <dd>None</dd>
        </dl>
      </MotionDialog>
    </li>
  );
}
