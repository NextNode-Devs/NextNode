"use client";

import { useId, useState, type FormEvent } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

type Member = { account_id: number; display_name: string };

type Props = { members: Member[] };

/**
 * A member proposes a new Lead from the team's current members, after the
 * Lead left or hasn't responded for 3 days (NN-38, prototype). The client
 * approves; the team never makes someone Lead on its own.
 */
export function ProposeLeadForm({ members }: Props) {
  const id = useId();
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) {
      setError("Choose a member to propose.");
      return;
    }
    setError(null);
    underConstruction("Proposing a new Lead");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-lg border p-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Propose a new Lead</legend>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Pick one of the current members. The client approves, then the new Lead signs the current offer.
        </p>
        <RadioGroup
          value={chosen}
          onValueChange={(next) => {
            if (next) {
              setChosen(next);
              setError(null);
            }
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={error ? true : undefined}
          className="space-y-1"
        >
          {members.map((m) => (
            <label key={m.account_id} htmlFor={`${id}-${m.account_id}`} className="flex min-h-9 items-center gap-2 text-sm">
              <RadioGroupItem id={`${id}-${m.account_id}`} value={String(m.account_id)} />
              {m.display_name}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm">
        Send to the client
      </Button>
    </form>
  );
}
