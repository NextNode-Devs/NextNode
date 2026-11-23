"use client";

import { UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import type { ReplacementCandidate } from "@/entities/team";
import { formatMessageTime } from "@/shared/lib/format-date";
import { underConstruction } from "@/shared/lib/toast";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

type Props = {
  candidates: ReplacementCandidate[];
  /** For the "Applied … / Invited …" times: the sample's own moment. */
  asOf: string;
};

/**
 * The Team Lead fills an open spot (NN-38, prototype): picks one of the
 * applicants or a developer they invited, or invites someone new.
 */
export function ReplacementPicker({ candidates, asOf }: Props) {
  const id = useId();
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) {
      setError("Choose someone to add to the team.");
      return;
    }
    setError(null);
    const name = candidates.find((c) => String(c.account_id) === chosen)?.display_name ?? "them";
    underConstruction(`Adding ${name} to the team`);
  };

  const invite = (
    <Button asChild variant="outline" size="sm">
      <Link href="/developers">
        <UserPlusIcon aria-hidden /> Invite a developer
      </Link>
    </Button>
  );

  if (candidates.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <p className="font-medium">No applicants yet</p>
        <p className="text-muted-foreground">Invite a developer from the directory; they appear here once they reply.</p>
        {invite}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-lg border p-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pick a replacement</legend>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          The client is told who joins. You can also invite someone new.
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
          className="space-y-2"
        >
          {candidates.map((c) => (
            <label
              key={c.account_id}
              htmlFor={`${id}-${c.account_id}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem id={`${id}-${c.account_id}`} value={String(c.account_id)} className="mt-0.5" />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{c.display_name}</span>
                  <Badge variant="secondary">{c.source === "applicant" ? "Applied" : "Invited"}</Badge>
                </span>
                <span className="block text-muted-foreground">{c.headline}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.skills.join(" · ")} · {c.source === "applicant" ? "applied" : "invited"} {formatMessageTime(c.at, asOf)}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="sm">
          Add to the team
        </Button>
        {invite}
      </div>
    </form>
  );
}
