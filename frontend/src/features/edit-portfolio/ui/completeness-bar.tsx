import type { Completeness } from "../model/completeness";

/** How complete the portfolio is, from what's on the form now (NN-34). */
export function CompletenessBar({
  completeness,
}: {
  completeness: Completeness;
}) {
  const { percent, missing } = completeness;
  return (
    <section
      aria-labelledby="completeness-title"
      className="space-y-2 rounded-xl border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="completeness-title" className="text-sm font-medium">
          Profile completeness
        </h2>
        <span className="text-sm font-semibold tabular-nums">
          {percent}% complete
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="completeness-title"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% complete`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {missing.length
          ? `Still to add: ${missing.join(", ")}.`
          : "Everything is filled in."}
      </p>
    </section>
  );
}
