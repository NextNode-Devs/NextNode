import { MilestoneStatusBadge, type MilestonePlan } from "@/entities/milestone";
import { PlannedPaymentStateBadge, type PlannedPayment } from "@/entities/payment";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import type { PaymentsViewer } from "./milestone-payments";

type Props = {
  viewer: PaymentsViewer;
  plan: MilestonePlan;
  payments: readonly PlannedPayment[];
};

const day = (iso: string | null) => (iso ? formatCalendarDate(iso.slice(0, 10)) : "");

/** One line saying what happens to this payment next, from the viewer's side. */
function nextStep(payment: PlannedPayment, viewer: PaymentsViewer): string {
  const approve = viewer === "client" ? "you approve" : "the client approves";
  if (payment.kind === "final") {
    return payment.state === "due"
      ? `Paid when ${approve} the finished project.`
      : `Paid ${day(payment.paid_at)} when the finished project was approved.`;
  }
  switch (payment.state) {
    case "held":
      return `Paid ${day(payment.paid_at)}. Released to the team when ${approve} milestone ${payment.release_milestone}; refundable until then.`;
    case "released":
      return `Released to the team ${day(payment.released_at)}, after milestone ${payment.release_milestone} was approved. No longer refundable.`;
    case "refunded":
      return `Refunded ${day(payment.refunded_at)}, minus Stripe's processing fee.`;
    case "due":
      return "Paid when the project starts.";
  }
}

/** The deposit and the final payment, then the milestones, marking the one that releases the deposit. */
export function PaymentSchedule({ viewer, plan, payments }: Props) {
  const ordered = [...payments].sort((a, b) => (a.kind === "deposit" ? -1 : b.kind === "deposit" ? 1 : 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Payment schedule</h2>
        </CardTitle>
        <CardDescription>
          A {plan.deposit_percent} % deposit when the project starts, and the rest when the finished project is
          approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="divide-y">
          {ordered.map((payment) => (
            <li key={payment.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium">
                  {payment.kind === "deposit" ? `Deposit (${plan.deposit_percent} %)` : "Final payment"}
                </p>
                <PlannedPaymentStateBadge state={payment.state} />
                <p className="text-sm text-muted-foreground">{nextStep(payment, viewer)}</p>
              </div>
              <p className="font-medium tabular-nums sm:text-right">{formatMoney(payment.amount_cents, payment.currency)}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="milestones-heading" className="space-y-3">
          <h3 id="milestones-heading" className="text-sm font-medium">
            Milestones
          </h3>
          <ol className="space-y-2">
            {plan.milestones.map((milestone) => (
              <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 text-sm">
                  {milestone.sequence}. {milestone.title}
                  <span className="block text-muted-foreground">Due {formatCalendarDate(milestone.due_date)}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {milestone.sequence === plan.deposit_release_milestone ? (
                    <Badge variant="outline">Releases the deposit</Badge>
                  ) : null}
                  <MilestoneStatusBadge status={milestone.status} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}
