import { cn } from "@/shared/lib/utils";

type Props = {
  /** Short month, already formatted ("NOV"). */
  month: string;
  /** Day of the month, already formatted ("21"). */
  day: string;
  /** Greyed out, for something already past. */
  muted?: boolean;
  className?: string;
};

/**
 * A small calendar-page chip: month over day. Decorative for sighted users;
 * the full date is read out instead, so put it in the row's own text too.
 */
export function DateChip({ month, day, muted = false, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex w-12 shrink-0 flex-col items-center rounded-md border py-1 leading-tight",
        muted ? "border-transparent bg-muted text-muted-foreground" : "bg-background",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-muted-foreground">{month}</span>
      <span className="text-lg font-semibold">{day}</span>
    </span>
  );
}
