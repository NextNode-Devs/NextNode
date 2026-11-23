"use client";

import { SendIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { REVIEW_RULES, reviewLinkProblem, reviewNoteProblem, type Milestone } from "@/entities/milestone";
import { underConstruction } from "@/shared/lib/toast";
import { FormField } from "@/shared/ui/molecules/form-field";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";
import { Textarea } from "@/shared/ui/shadcn/textarea";

type Props = {
  milestone: Pick<Milestone, "sequence" | "title">;
  /** Moves the sample milestone on screen (prototype preview; nothing is saved). */
  onSubmit: (note: string, link: string | null) => void;
  /** This milestone has been sent back before: the Lead is resubmitting. */
  resubmission?: boolean;
};

type Errors = { note?: string; link?: string };

/**
 * The Team Lead sends a milestone's work to the client for review (NN-16b,
 * prototype). Checks the note and link like the planned API would, then
 * says the action is under construction.
 */
export function SubmitMilestoneButton({ milestone, onSubmit, resubmission = false }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const label = resubmission ? "Resubmit for review" : "Submit for review";

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setErrors({});
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {
      note: reviewNoteProblem("submit", note) ?? undefined,
      link: reviewLinkProblem(link) ?? undefined,
    };
    setErrors(found);
    if (found.note || found.link) return;
    onSubmit(note.trim(), link.trim() || null);
    setOpen(false);
    setNote("");
    setLink("");
    underConstruction("Submit milestone for review");
  }

  return (
    <MotionDialog
      open={open}
      onOpenChange={changeOpen}
      title={`${label}: milestone ${milestone.sequence}`}
      description={`"${milestone.title}" goes to the client, who approves it or asks for changes.`}
      trigger={
        <Button type="button">
          <SendIcon aria-hidden data-icon="inline-start" />
          {label}
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`}>
            Send to the client
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} noValidate onSubmit={submit} className="space-y-4">
        <FormField
          id={`${id}-note`}
          label={resubmission ? "What changed" : "What's ready"}
          required
          error={errors.note}
          hint="The client reads this first. Say what to look at and how to try it."
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
                if (errors.note) setErrors((c) => ({ ...c, note: undefined }));
              }}
            />
          )}
        </FormField>
        <FormField id={`${id}-link`} label="Link to the work" error={errors.link} hint="A staging site, pull request or demo video.">
          {(aria) => (
            <Input
              {...aria}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                if (errors.link) setErrors((c) => ({ ...c, link: undefined }));
              }}
            />
          )}
        </FormField>
      </form>
    </MotionDialog>
  );
}
