"use client";

import { RotateCcwIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { REVIEW_RULES, reviewNoteProblem, type Milestone } from "@/entities/milestone";
import { underConstruction } from "@/shared/lib/toast";
import { FormField } from "@/shared/ui/molecules/form-field";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

type Props = {
  milestone: Pick<Milestone, "sequence" | "title">;
  /** Moves the sample milestone on screen (prototype preview; nothing is saved). */
  onRequest: (note: string) => void;
};

/**
 * The client sends a milestone back with the changes they need (NN-16b,
 * prototype). It returns to "In progress" and the Team Lead resubmits.
 */
export function RequestRevisionButton({ milestone, onRequest }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setError(undefined);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = reviewNoteProblem("request_revision", note);
    setError(problem ?? undefined);
    if (problem) return;
    onRequest(note.trim());
    setOpen(false);
    setNote("");
    underConstruction("Request a revision");
  }

  return (
    <MotionDialog
      open={open}
      onOpenChange={changeOpen}
      title={`Request changes to milestone ${milestone.sequence}`}
      description={`"${milestone.title}" goes back to the team. The Team Lead resubmits it when the changes are made.`}
      trigger={
        <Button type="button" variant="outline">
          <RotateCcwIcon aria-hidden data-icon="inline-start" />
          Request changes
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`}>
            Send back to the team
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} noValidate onSubmit={submit}>
        <FormField
          id={`${id}-note`}
          label="What needs to change"
          required
          error={error}
          hint="Be specific: what you tried, what happened, what you expected."
        >
          {(aria) => (
            <Textarea
              {...aria}
              required
              rows={4}
              maxLength={REVIEW_RULES.noteMax}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(undefined);
              }}
            />
          )}
        </FormField>
      </form>
    </MotionDialog>
  );
}
