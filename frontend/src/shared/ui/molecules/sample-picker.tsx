"use client";

import { useId } from "react";

import { cn } from "@/shared/lib/utils";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  current: T;
  onChange: (next: T) => void;
  /** What is being switched; read out as the group's name. */
  label?: string;
};

/**
 * Prototype only (Phase 2): switches a screen's sample data between the
 * situations it covers. Toggle buttons, so each is one Tab stop and announces
 * whether it is pressed.
 */
export function SamplePicker<T extends string>({ options, current, onChange, label = "Sample situation" }: Props<T>) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="space-y-1.5">
      <p id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-1 rounded-lg bg-muted p-1 min-[400px]:grid-cols-3 sm:flex sm:flex-wrap">
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
