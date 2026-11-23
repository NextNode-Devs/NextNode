"use client";

import { useId, useState, type FormEvent } from "react";

import {
  depositCentsFor,
  MILESTONE_RULES,
  MilestonePlanList,
  type DepositReleaseChoice,
  type Milestone,
} from "@/entities/milestone";
import { formatMoney } from "@/shared/lib/format-money";
import { underConstruction } from "@/shared/lib/toast";
import { InfoTip } from "@/shared/ui/molecules/info-tip";
import { Button } from "@/shared/ui/shadcn/button";
import { Label } from "@/shared/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

type Item = Pick<Milestone, "sequence" | "title" | "amount_cents" | "due_date">;

type Props = {
  projectTitle: string;
  offerTotalCents: number;
  depositPercent: number;
  milestones: Item[];
  currency?: string;
};

/**
 * The client accepts every milestone of the offer together and picks
 * milestone 1 or 2 as the one whose approval releases the deposit
 * (NN-16a #94, prototype). Accepting shows the under-construction toast.
 */
export function AcceptMilestones({ projectTitle, offerTotalCents, depositPercent, milestones, currency = "CAD" }: Props) {
  const id = useId();
  const [choice, setChoice] = useState<DepositReleaseChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deposit = formatMoney(depositCentsFor(offerTotalCents, depositPercent), currency);
  const options = milestones.filter((item) =>
    (MILESTONE_RULES.depositReleaseChoices as readonly number[]).includes(item.sequence),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice === null) {
      setError("Choose milestone 1 or 2.");
      return;
    }
    underConstruction("Accepting the offer's milestones");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <p className="rounded-md bg-muted px-3 py-2 text-sm">
        You&apos;re accepting as the <span className="font-medium">client</span> of{" "}
        <span className="font-medium">{projectTitle}</span>. Accepting agrees to all {milestones.length} milestones
        together.
      </p>

      <MilestonePlanList milestones={milestones} currency={currency} />
      <p className="text-sm">
        Deposit: <span className="font-medium">{depositPercent} %</span> of {formatMoney(offerTotalCents, currency)} ={" "}
        <span className="font-medium">{deposit}</span>, paid when the project starts. The rest is one final payment
        when you approve the finished project.
      </p>

      <fieldset className="space-y-3" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="flex items-center gap-1 text-sm font-medium">
          Which milestone releases your deposit?
          <InfoTip label="When is the deposit released?">
            Your deposit of {deposit} is held until you approve the milestone you choose. Then it goes to the team and
            can no longer be refunded. If the project is cancelled before that, the deposit is refunded minus
            Stripe&apos;s processing fee.
          </InfoTip>
        </legend>
        <RadioGroup
          value={choice === null ? "" : String(choice)}
          onValueChange={(value) => {
            setChoice(Number(value) as DepositReleaseChoice);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
        >
          {options.map((item) => (
            <div key={item.sequence} className="flex items-center gap-3">
              <RadioGroupItem id={`${id}-m${item.sequence}`} value={String(item.sequence)} />
              <Label htmlFor={`${id}-m${item.sequence}`} className="font-normal">
                Milestone {item.sequence}: {item.title}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {error ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </fieldset>

      <Button type="submit" size="lg">
        Accept all {milestones.length} milestones
      </Button>
    </form>
  );
}
