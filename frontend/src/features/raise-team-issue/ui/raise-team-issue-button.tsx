"use client";

import { FlagIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { FormField } from "@/shared/ui/molecules/form-field";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";
import { Label } from "@/shared/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import {
  checkTeamIssue,
  EMPTY_TEAM_ISSUE,
  TEAM_ISSUE_MAX_LENGTH,
  TEAM_ISSUE_TOPIC_LABEL,
  TEAM_ISSUE_TOPICS,
  type TeamIssueDraft,
  type TeamIssueErrors,
  type TeamIssueTopic,
} from "../model/check-team-issue";

type Props = { leadName: string };

/**
 * "Raise an issue with your Team Lead" (NN-40, stakeholder Q5). Disputes
 * inside a team go to its Team Lead first. PROTOTYPE: the form checks its
 * fields like the planned API would, then shows the under-construction toast;
 * nothing is sent to the Lead.
 */
export function RaiseTeamIssueButton({ leadName }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TeamIssueDraft>(EMPTY_TEAM_ISSUE);
  const [errors, setErrors] = useState<TeamIssueErrors>({});

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setDraft(EMPTY_TEAM_ISSUE);
      setErrors({});
    }
  }

  function set<K extends keyof TeamIssueDraft>(key: K, value: TeamIssueDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = checkTeamIssue(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    changeOpen(false);
    underConstruction("Raise an issue with your Team Lead");
  }

  const formId = `${id}-form`;
  const topicError = errors.topic ? `${id}-topic-error` : undefined;

  return (
    <MotionDialog
      open={open}
      onOpenChange={changeOpen}
      title="Raise an issue with your Team Lead"
      description={`${leadName} sees what you write here and works it out with the team. Only you and the Team Lead see it.`}
      trigger={
        <Button type="button" variant="outline">
          <FlagIcon aria-hidden data-icon="inline-start" />
          Raise an issue with your Team Lead
        </Button>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            Send to Team Lead
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4 text-sm">
        <PrototypeBadge className="w-fit" />
        <fieldset className="space-y-2" aria-describedby={topicError}>
          <legend className="mb-2 text-sm font-medium">
            What is it about? <span aria-hidden className="text-destructive">*</span>
          </legend>
          <RadioGroup
            value={draft.topic}
            onValueChange={(value) => set("topic", value as TeamIssueTopic)}
            aria-invalid={Boolean(errors.topic)}
          >
            {TEAM_ISSUE_TOPICS.map((topic) => (
              <div key={topic} className="flex min-h-9 items-center gap-2">
                <RadioGroupItem id={`${id}-${topic}`} value={topic} />
                <Label htmlFor={`${id}-${topic}`} className="font-normal">
                  {TEAM_ISSUE_TOPIC_LABEL[topic]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {errors.topic ? (
            <p id={topicError} className="text-sm text-destructive">
              {errors.topic}
            </p>
          ) : null}
        </fieldset>
        <FormField
          id={`${id}-details`}
          label="What happened"
          required
          error={errors.details}
          hint="Stick to what happened and what would help. Keep it respectful."
        >
          {(aria) => (
            <Textarea
              {...aria}
              required
              rows={4}
              maxLength={TEAM_ISSUE_MAX_LENGTH}
              value={draft.details}
              onChange={(e) => set("details", e.target.value)}
            />
          )}
        </FormField>
        <p className="text-muted-foreground">
          If it can&apos;t be sorted out inside the team, use Contact support.
        </p>
      </form>
    </MotionDialog>
  );
}
