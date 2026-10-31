import type { ReactNode } from "react";

import { Label } from "@/shared/ui/shadcn/label";

type Props = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Show "(optional)" beside a label that isn't required. Off for filters, where nothing is required. */
  markOptional?: boolean;
  /** Renders the control; receives the ids it must reference. */
  children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

/** A labelled control with its hint and its error placed on the field. */
export function FormField({ id, label, required, hint, error, markOptional = true, children }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : markOptional ? (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
