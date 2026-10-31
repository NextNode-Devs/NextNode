"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { todayIso } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { validateDraft, type FieldErrors, type ProjectDraft } from "../model/draft";
import { PROJECT_LIMITS as L, type ProjectKind } from "../model/project";

export type SaveFailure = { message: string; fields: FieldErrors };

export type TechStackInputProps = {
  id: string;
  value: string[];
  onChange: (tech: string[]) => void;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type Props = {
  kind: ProjectKind;
  initial: ProjectDraft;
  /** Resolves with a failure to show, or navigates away on success. */
  submit: (draft: ProjectDraft) => Promise<SaveFailure | undefined | void>;
  /** The tech stack input (the shared skills input), passed in by the feature using the form. */
  renderTechStack: (props: TechStackInputProps) => ReactNode;
  submitLabel: string;
  pendingLabel: string;
  failureTitle: string;
  cancelHref: string;
};

const CHECK_FIELDS = "Some details need attention. Check the highlighted fields.";

/** A project's brief or idea. Errors show on each field, with a summary at the top. */
export function ProjectForm(props: Props) {
  const { kind, initial, submit, renderTechStack, submitLabel, pendingLabel, failureTitle, cancelHref } = props;
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = useRef<HTMLDivElement>(null);

  const update = <K extends keyof ProjectDraft>(field: K, value: ProjectDraft[K], errorKey: string = field) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(errorKey in current)) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  const fail = (message: string, fields: FieldErrors) => {
    setFailure(message);
    setErrors(fields);
    requestAnimationFrame(() => summary.current?.focus());
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateDraft(kind, draft, todayIso());
    if (Object.keys(problems).length) return fail(CHECK_FIELDS, problems);
    setFailure(null);
    startTransition(async () => {
      const result = await submit(draft);
      if (result) fail(result.message, result.fields);
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-6">
      {failure ? (
        <Alert ref={summary} tabIndex={-1} variant="destructive" role="alert" className="outline-none">
          <AlertTitle>{failureTitle}</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="title"
        label="Title"
        required
        hint={`${L.titleMin} to ${L.title} characters.`}
        error={errors.title}
      >
        {(aria) => (
          <Input {...aria} required maxLength={L.title} value={draft.title} onChange={(e) => update("title", e.target.value)} />
        )}
      </FormField>

      <FormField
        id="description"
        label={kind === "client" ? "Scope" : "Description"}
        required
        hint={
          kind === "client"
            ? "What you need built, who it's for, and anything the team must know."
            : "What you want to build, and what makes it interesting to work on."
        }
        error={errors.description}
      >
        {(aria) => (
          <Textarea
            {...aria}
            required
            rows={6}
            maxLength={L.description}
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="tech_stack"
        label="Tech stack"
        required
        hint="Type a technology and press Enter, e.g. React."
        error={errors.tech_stack}
      >
        {(aria) => renderTechStack({ ...aria, value: draft.tech_stack, onChange: (tech) => update("tech_stack", tech) })}
      </FormField>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          id="target_delivery_date"
          label="Target delivery date"
          required
          error={errors.target_delivery_date}
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              required
              value={draft.target_delivery_date}
              onChange={(e) => update("target_delivery_date", e.target.value)}
            />
          )}
        </FormField>

        {kind === "client" ? (
          <FormField
            id="proposed_budget_cents"
            label="Proposed budget (CAD)"
            required
            hint={`At least ${formatMoney(L.minBudgetCents, "cad")}. You and your Team Lead can negotiate it before you accept an offer.`}
            error={errors.proposed_budget_cents}
          >
            {(aria) => (
              <Input
                {...aria}
                inputMode="decimal"
                required
                placeholder="e.g. 2,500"
                value={draft.budget}
                onChange={(e) => update("budget", e.target.value, "proposed_budget_cents")}
              />
            )}
          </FormField>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
