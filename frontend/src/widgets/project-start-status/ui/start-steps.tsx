import { CircleCheckIcon, CircleIcon } from "lucide-react";

import type { GateCondition } from "@/entities/start-gate";

/** The start conditions in order, each marked done or not, in words as well as icons. */
export function StartSteps({ conditions }: { conditions: GateCondition[] }) {
  return (
    <ol aria-label="Start conditions" className="space-y-2 text-sm">
      {conditions.map((condition) => (
        <li key={condition.key} className="flex items-start gap-2">
          {condition.met ? (
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className={condition.met ? undefined : "text-muted-foreground"}>
            {/* Status first, so screen readers hear it before the label. */}
            <span className="sr-only">{condition.met ? "Done: " : "Not done yet: "}</span>
            {condition.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
