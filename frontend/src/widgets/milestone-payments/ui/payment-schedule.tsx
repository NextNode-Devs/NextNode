import { MilestoneStatusBadge, type Milestone } from "@/entities/milestone";
import { PlannedPaymentStateBadge, type PlannedPayment } from "@/entities/payment";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import type { PaymentsViewer } from "./milestone-payments";

type Props = {
  viewer: PaymentsViewer;
  payments: readonly PlannedPayment[];
  milestones: readonly Milestone[];
};

const day = (iso: string | null) => (iso ? formatCalendarDate(iso.slice(0, 10)) : "");

/** One line saying what happens to this payment next, from the viewer's side. */
function nextStep(payment: PlannedPayment, milestone: Milestone | undefined, viewer: PaymentsViewer): string {
  const approver = viewer === "client" ? "you approve" : "the client approves";
  switch (payment.state) {
    case "held":
      return `Paid ${day(payment.paid_at)}. Released when ${approver} milestone ${payment.release_milestone}; refundable until then.`;
    case "released":
      return `Released ${day(payment.released_at)}, after milestone ${payment.release_milestone} was approved. No longer refundable.`;
    case "refunded":
      return `Refunded in full ${day(payment.refunded_at)}.`;
    case "due":
      return milestone
        ? `Paid when milestone ${milestone.sequence} starts (due by ${formatCalendarDate(milestone.due_date)}).`
        : "Not paid yet.";
  }
}

/** The deposit, then every milestone payment, in order. */
export function PaymentSchedule({ viewer, payments, milestones }: Props) {
  const byNumber = new Map(milestones.map((item) => [item.sequence, item]));
  const ordered = [...payments].sort(
    (a, b) => (a.kind === "deposit" ? -1 : b.kind === "deposit" ? 1 : a.release_milestone - b.release_milestone),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Payment schedule</h2>
        </CardTitle>
        <CardDescription>
          Each payment is held until its milestone is approved. The deposit is held until the milestone the client chose.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {ordered.map((payment) => {
            const milestone = payment.kind === "milestone" ? byNumber.get(payment.release_milestone) : undefined;
            const name =
              payment.kind === "deposit" ? "Deposit" : `Milestone ${payment.release_milestone}${milestone ? `: ${milestone.title}` : ""}`;
            return (
              <li key={payment.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0 space-y-1.5">
                  <p className="font-medium">{name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <PlannedPaymentStateBadge state={payment.state} />
                    {milestone ? <MilestoneStatusBadge status={milestone.status} /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{nextStep(payment, milestone, viewer)}</p>
                </div>
                <p className="font-medium tabular-nums sm:text-right">{formatMoney(payment.amount_cents, payment.currency)}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
