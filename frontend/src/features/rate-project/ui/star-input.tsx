"use client";

import { StarIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type Props = {
  /** Unique per field: names the radio group. */
  name: string;
  value: number | null;
  onChange: (stars: number) => void;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * 1–5 stars as a radio group: arrow keys move between stars, each has a
 * spoken label, and the focused star shows a ring.
 */
export function StarInput({ name, value, onChange, invalid = false, describedBy }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Stars"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((stars) => {
        const id = `${name}-${stars}`;
        const lit = value !== null && stars <= value;
        return (
          <label key={stars} htmlFor={id} className="relative cursor-pointer">
            <input
              id={id}
              type="radio"
              name={name}
              value={stars}
              checked={value === stars}
              onChange={() => onChange(stars)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {stars} {stars === 1 ? "star" : "stars"}
            </span>
            <StarIcon
              aria-hidden
              className={cn(
                "size-8 rounded-md p-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                lit ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500",
              )}
            />
          </label>
        );
      })}
    </div>
  );
}
