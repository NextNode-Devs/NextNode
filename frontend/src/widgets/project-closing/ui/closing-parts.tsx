import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";

import { approvedMilestones, type ProjectClosing } from "@/entities/project";
import { formatMoney } from "@/shared/lib/format-money";
import { formatMomentDate } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/** Every milestone with a tick once the client approved it. */
export function MilestoneChecklist({ closing }: { closing: ProjectClosing }) {
  const done = approvedMilestones(closing);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle className="text-base">
          <h2>Milestones</h2>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {done} of {closing.milestones.length} approved
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {closing.milestones.map((m) => (
            <li key={m.sequence} className="flex items-start gap-2 text-sm">
              {m.approved_at ? (
                <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <CircleDashedIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1">
                {m.sequence}. {m.title}
              </span>
              <span className="text-muted-foreground">
                {m.approved_at ? `Approved ${formatMomentDate(m.approved_at)}` : "Not approved yet"}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** The offer total, the deposit and the final payment (PLANNED). */
export function PaymentSummary({ closing, paid }: { closing: ProjectClosing; paid: boolean }) {
  const money = (cents: number) => formatMoney(cents, closing.currency);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          <h2>Final payment</h2>
        </CardTitle>
        <PrototypeBadge label="Planned" />
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <Row term="Offer total" value={money(closing.total_cents)} />
          <Row term="Deposit (paid, released to the team)" value={money(closing.deposit_cents)} />
          <Row
            term={paid ? "Final payment (paid)" : "Final payment (charged on final approval)"}
            value={money(closing.final_payment_cents)}
            strong
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ term, value, strong = false }: { term: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className={strong ? "font-semibold" : undefined}>{value}</dd>
    </div>
  );
}
