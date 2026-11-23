"use client";

import { useId, useState, type FormEvent } from "react";

import { RATING_RULES, ratingProblems, type RatingTarget, type RatingValue } from "@/entities/rating";
import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";
import { Label } from "@/shared/ui/shadcn/label";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { StarInput } from "./star-input";

type Props = {
  targets: RatingTarget[];
  /** The Team Lead's comment on a member is their Team Lead reference, shown on the member's portfolio. */
  commentIsReference: boolean;
  /** Shows the ratings as sent (prototype preview; nothing is saved). */
  onSubmitted: (values: Record<string, RatingValue>) => void;
};

/**
 * Rate the people on a completed project (NN-35, prototype): 1–5 stars each,
 * plus an optional comment or Team Lead reference. Checks it like the planned
 * API would, then says it's under construction.
 */
export function RatingForm({ targets, commentIsReference, onSubmitted }: Props) {
  const id = useId();
  const [values, setValues] = useState<Record<string, RatingValue>>(() =>
    Object.fromEntries(targets.map((t) => [t.key, { stars: null, comment: "" }])),
  );
  const [problems, setProblems] = useState<Record<string, string>>({});

  function set(key: string, patch: Partial<RatingValue>) {
    setValues((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    if (problems[key]) {
      setProblems((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = ratingProblems(targets, values);
    setProblems(found);
    const first = targets.find((t) => found[t.key]);
    if (first) {
      document.getElementById(`${id}-${first.key}-1`)?.focus();
      return;
    }
    onSubmitted(values);
    underConstruction("Send ratings");
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {targets.map((target) => {
        const field = `${id}-${target.key}`;
        const problem = problems[target.key];
        const value = values[target.key];
        return (
          <fieldset key={target.key} className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 font-medium">{target.name}</legend>
            <StarInput
              name={field}
              value={value.stars}
              onChange={(stars) => set(target.key, { stars })}
              invalid={Boolean(problem)}
              describedBy={problem ? `${field}-error` : undefined}
            />
            {problem ? (
              <p id={`${field}-error`} role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`${field}-comment`}>
                {commentIsReference ? "Team Lead reference (optional)" : "Comment (optional)"}
              </Label>
              <Textarea
                id={`${field}-comment`}
                rows={3}
                maxLength={RATING_RULES.commentMax}
                value={value.comment}
                aria-describedby={`${field}-hint`}
                onChange={(e) => set(target.key, { comment: e.target.value })}
              />
              <p id={`${field}-hint`} className="text-xs text-muted-foreground">
                {commentIsReference
                  ? `Shown on ${target.name}'s portfolio as a Team Lead reference.`
                  : "Only the person rated and NextNode see it."}
              </p>
            </div>
          </fieldset>
        );
      })}
      <Button type="submit">Send ratings</Button>
    </form>
  );
}
