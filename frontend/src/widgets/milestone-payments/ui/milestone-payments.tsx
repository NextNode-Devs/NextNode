import { type MilestonePlan, milestonesTotalCents } from "@/entities/milestone";
import { plannedPaymentTotals, refundableNow, refundAmountCents, type PlannedPayment } from "@/entities/payment";
import { RequestRefundButton } from "@/features/request-refund";
import { formatMoney } from "@/shared/lib/format-money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { PaymentSchedule } from "./payment-schedule";
import { ReceiptsList } from "./receipts-list";

/** The client sees receipts and can cancel; the Team Lead and members only see the schedule. */
export type PaymentsViewer = "client" | "team";

type Props = {
  viewer: PaymentsViewer;
  plan: MilestonePlan;
  payments: readonly PlannedPayment[];
};

/**
 * PLANNED payments for one client project (Phase 2 prototype, NN-37 #96):
 * the deposit is held until the client approves the milestone they chose.
 * Shows sample data; nothing here charges, holds or moves money.
 */
export function MilestonePayments({ viewer, plan, payments }: Props) {
  const totals = plannedPaymentTotals(payments);
  const offerTotal = milestonesTotalCents(plan.milestones);
  const money = (cents: number) => formatMoney(cents, "CAD");
  const deposit = payments.find((item) => item.kind === "deposit");
  const depositCents = Math.round((offerTotal * plan.deposit_percent) / 100);
  const releaseOn = plan.deposit_release_milestone ? `milestone ${plan.deposit_release_milestone}` : "the milestone you chose";
  const refundLines = refundableNow(payments).map((item) => ({
    id: item.id,
    label: item.kind === "deposit" ? "Deposit" : "Final payment",
    amount_cents: item.amount_cents,
    fee_cents: item.processing_fee_cents ?? 0,
    refund_cents: refundAmountCents(item),
  }));
  const stats = [
    { label: viewer === "client" ? "Paid by you" : "Paid by the client", value: totals.paid_cents },
    { label: "Held (refundable)", value: totals.held_cents },
    { label: "Released to the team", value: totals.released_cents },
    { label: "Still to pay", value: totals.due_cents },
  ];

  return (
    // minmax(0, …) lets the columns shrink on phones instead of overflowing.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <section aria-label="Payment totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-semibold tabular-nums">{money(stat.value)}</p>
            </div>
          ))}
        </section>
        <PaymentSchedule viewer={viewer} plan={plan} payments={payments} />
        {viewer === "client" ? <ReceiptsList payments={payments} /> : null}
      </div>
      <aside className="min-w-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>How it adds up</h2>
            </CardTitle>
            <CardDescription>Nothing hidden.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Offer total</dt>
              <dd className="tabular-nums">{money(offerTotal)}</dd>
              <dt className="text-muted-foreground">Deposit ({plan.deposit_percent} %), at the start</dt>
              <dd className="tabular-nums">{money(depositCents)}</dd>
              <dt className="text-muted-foreground">Final payment, on approval</dt>
              <dd className="tabular-nums">{money(offerTotal - depositCents)}</dd>
              <dt className="text-muted-foreground">Deposit released on</dt>
              <dd>{plan.deposit_release_milestone ? `Milestone ${plan.deposit_release_milestone}` : "Not chosen"}</dd>
              <dt className="text-muted-foreground">NextNode fee</dt>
              <dd>None</dd>
              <dt className="text-muted-foreground">Refund fee</dt>
              <dd>Stripe&apos;s processing fee</dd>
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              You pay the offer total and nothing more. If the deposit is refunded, Stripe keeps its processing fee
              {deposit?.processing_fee_cents ? ` (${money(deposit.processing_fee_cents)} on your deposit)` : ""}, so
              that amount is not returned.
            </p>
          </CardContent>
        </Card>
        {viewer === "client" ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Cancel the project</h2>
              </CardTitle>
              <CardDescription>
                Until you approve {releaseOn}, you can cancel and get your deposit back, minus Stripe&apos;s
                processing fee. After that, the deposit has gone to the team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestRefundButton lines={refundLines} />
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
