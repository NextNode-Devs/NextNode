import { formatCalendarDate } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";

import type { Milestone } from "../model/milestone";

type Item = Pick<Milestone, "sequence" | "title" | "amount_cents" | "due_date">;

/** An offer's milestones in order, each with its amount and due date (NN-16a). */
export function MilestonePlanList({ milestones, currency = "CAD" }: { milestones: readonly Item[]; currency?: string }) {
  return (
    <ol aria-label="Milestones" className="divide-y rounded-lg border">
      {milestones.map((item) => (
        <li key={item.sequence} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Milestone {item.sequence}</p>
            <p className="font-medium break-words">{item.title}</p>
          </div>
          <div className="shrink-0 text-sm sm:text-right">
            <p className="font-medium tabular-nums">{formatMoney(item.amount_cents, currency)}</p>
            <p className="text-muted-foreground">Due {formatCalendarDate(item.due_date)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
