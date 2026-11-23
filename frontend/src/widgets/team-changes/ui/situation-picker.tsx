"use client";

import { SITUATION_LABEL, type TeamSituation } from "@/entities/team";
import { cn } from "@/shared/lib/utils";

type Props = {
  situations: TeamSituation[];
  current: TeamSituation;
  onChange: (next: TeamSituation) => void;
};

/** Prototype only: switches the sample between the situations the flow covers. */
export function SituationPicker({ situations, current, onChange }: Props) {
  return (
    <div role="group" aria-labelledby="sample-situation-label" className="space-y-1.5">
      <p id="sample-situation-label" className="text-xs font-medium text-muted-foreground">
        Sample situation
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:flex sm:flex-wrap">
        {situations.map((situation) => {
          const active = situation === current;
          return (
            <button
              key={situation}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(situation)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SITUATION_LABEL[situation]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
