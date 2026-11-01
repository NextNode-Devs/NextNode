"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { setTeamSize, TEAM_SIZES } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

type Props = {
  projectId: number;
  /** The current total, or null before the Team Lead has chosen one. */
  size: number | null;
  /** People already on the team: a smaller size isn't offered. */
  headcount: number;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/** The Team Lead chooses the team's total, themselves included. The backend re-checks every rule. */
export function SetTeamSize({ projectId, size, headcount, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [chosen, setChosen] = useState(size === null ? "" : String(size));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) {
      setError("Choose a team size.");
      return;
    }
    setSending(true);
    setError(null);
    setSaved(false);
    const result = await setTeamSize(api, projectId, Number(chosen));
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSaved(true);
    router.refresh(); // the open spots and who can apply have changed
  };

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-2 rounded-lg border p-3">
      <fieldset className="space-y-2">
        <legend id={`${id}-title`} className="text-sm font-medium">
          Team size
        </legend>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Total people, you included. Choosing a size opens the spots for developers.
        </p>
        <RadioGroup
          value={chosen}
          onValueChange={(next) => {
            if (next) setChosen(next);
          }}
          disabled={sending}
          aria-describedby={`${id}-hint`}
          className="flex gap-4"
        >
          {TEAM_SIZES.map((option) => (
            <label key={option} htmlFor={`${id}-${option}`} className="flex items-center gap-2 text-sm">
              <RadioGroupItem id={`${id}-${option}`} value={String(option)} disabled={option < headcount} />
              {option}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" size="sm" disabled={sending}>
        {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {sending ? "Saving…" : size === null ? "Open the spots" : "Save size"}
      </Button>
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Team size saved.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
