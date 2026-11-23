"use client";

import { cn } from "@/shared/lib/utils";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  current: T;
  onChange: (next: T) => void;
};

/** Prototype only: switches the sample between the points in finishing a project. */
export function SamplePicker<T extends string>({ options, current, onChange }: Props<T>) {
  return (
    <div role="group" aria-labelledby="closing-sample-label" className="space-y-1.5">
      <p id="closing-sample-label" className="text-xs font-medium text-muted-foreground">
        Sample situation
      </p>
      <div className="grid gap-1 rounded-lg bg-muted p-1 sm:flex sm:flex-wrap">
        {options.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
