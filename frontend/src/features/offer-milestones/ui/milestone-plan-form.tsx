"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import {
  depositCentsFor,
  MILESTONE_RULES,
  milestonesTotalCents,
  type MilestoneDraftRow,
} from "@/entities/milestone";
import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

import { MAX_MILESTONES, parseRows, planProblems } from "../model/plan-draft";

type Props = {
  projectTitle: string;
  offerTotalCents: number;
  /** The rows to start from (prototype sample, three milestones). */
  initialRows: MilestoneDraftRow[];
  currency?: string;
};

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * The Team Lead's milestone plan for the offer (NN-16a #94, prototype): at
 * least three milestones with an amount and due date, adding up to the offer
 * total, and the deposit % (20 unless agreed higher). Sending shows the
 * under-construction toast; the Phase 1 offer form is unchanged.
 */
export function MilestonePlanForm({ projectTitle, offerTotalCents, initialRows, currency = "CAD" }: Props) {
  const id = useId();
  const [rows, setRows] = useState(initialRows);
  const [percent, setPercent] = useState<number>(MILESTONE_RULES.defaultDepositPercent);
  const [problems, setProblems] = useState<string[]>([]);
  const nextKey = useRef(initialRows.length + 1);
  const summary = useRef<HTMLDivElement>(null);

  const total = milestonesTotalCents(parseRows(rows));
  const balanced = total === offerTotalCents;
  const update = (index: number, field: keyof Omit<MilestoneDraftRow, "key">, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = planProblems(rows, offerTotalCents);
    setProblems(found);
    if (found.length > 0) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    underConstruction("Sending the milestones with your offer");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <p className="rounded-md bg-muted px-3 py-2 text-sm">
        You&apos;re sending this as the <span className="font-medium">Team Lead</span> of{" "}
        <span className="font-medium">{projectTitle}</span>.
      </p>

      {problems.length > 0 ? (
        <Alert ref={summary} tabIndex={-1} variant="destructive" role="alert" className="outline-none">
          <AlertTitle>The milestones can&apos;t be sent yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <ol aria-label="Milestones" className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.key} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Milestone {index + 1}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rows.length <= MILESTONE_RULES.minPerOffer}
                aria-label={`Remove milestone ${index + 1}`}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
            <FormField id={`${id}-${row.key}-title`} label="Title" required>
              {(aria) => (
                <Input {...aria} maxLength={MILESTONE_RULES.titleMax} value={row.title} onChange={(e) => update(index, "title", e.target.value)} />
              )}
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id={`${id}-${row.key}-amount`} label={`Amount (${currency})`} required>
                {(aria) => (
                  <Input {...aria} inputMode="decimal" value={row.amount} onChange={(e) => update(index, "amount", e.target.value)} />
                )}
              </FormField>
              <FormField id={`${id}-${row.key}-due`} label="Due date" required>
                {(aria) => (
                  <Input {...aria} type="date" value={row.due_date} onChange={(e) => update(index, "due_date", e.target.value)} />
                )}
              </FormField>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= MAX_MILESTONES}
          onClick={() => {
            const key = `m${nextKey.current++}`;
            setRows((current) => [...current, { key, title: "", amount: "", due_date: "" }]);
          }}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          Add a milestone
        </Button>
        <p role="status" className={cn("text-sm tabular-nums", balanced ? "text-muted-foreground" : "text-destructive")}>
          Milestones add up to {formatMoney(total, currency)} of the {formatMoney(offerTotalCents, currency)} offer total
          {balanced ? "." : ` (${formatMoney(offerTotalCents - total, currency)} ${total < offerTotalCents ? "left" : "over"}).`}
        </p>
      </div>

      <FormField
        id={`${id}-deposit`}
        label="Deposit"
        hint={`${MILESTONE_RULES.defaultDepositPercent} % unless you and the client agree a higher deposit, for example on a long or large project. Every offer has at least ${MILESTONE_RULES.minPerOffer} milestones.`}
        markOptional={false}
      >
        {(aria) => (
          <select {...aria} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={cn(SELECT_CLASS, "sm:w-60")}>
            {MILESTONE_RULES.depositPercentOptions.map((option) => (
              <option key={option} value={option}>
                {option} % ({formatMoney(depositCentsFor(offerTotalCents, option), currency)})
              </option>
            ))}
          </select>
        )}
      </FormField>

      <Button type="submit" size="lg">
        Send milestones with the offer
      </Button>
    </form>
  );
}
