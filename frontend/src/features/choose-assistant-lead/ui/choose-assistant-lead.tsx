"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { chooseAssistantLead } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

type Member = { account_id: number; display_name: string };

type Props = {
  projectId: number;
  members: Member[];
  /** The current Assistant Lead's account id, if there is one. */
  current: number | null;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/** The Team Lead picks one member as Assistant Lead (NN-39). The backend re-checks every rule. */
export function ChooseAssistantLead({ projectId, members, current, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [chosen, setChosen] = useState(current === null ? "" : String(current));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) {
      setError("Choose a member.");
      return;
    }
    setSending(true);
    setError(null);
    setSaved(false);
    const result = await chooseAssistantLead(api, projectId, Number(chosen));
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSaved(true);
    router.refresh(); // the roster shows the new Assistant Lead
  };

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-2 rounded-lg border p-3">
      <fieldset className="space-y-2">
        <legend id={`${id}-title`} className="text-sm font-medium">
          {current === null ? "Choose an Assistant Lead" : "Change the Assistant Lead"}
        </legend>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          One member who helps you run the project. They can never remove you or override your decisions.
        </p>
        <RadioGroup
          value={chosen}
          onValueChange={(next) => {
            if (next) setChosen(next);
          }}
          disabled={sending}
          aria-describedby={`${id}-hint`}
          className="space-y-1"
        >
          {members.map((member) => (
            <label key={member.account_id} htmlFor={`${id}-${member.account_id}`} className="flex items-center gap-2 text-sm">
              <RadioGroupItem id={`${id}-${member.account_id}`} value={String(member.account_id)} />
              {member.display_name}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" size="sm" disabled={sending || chosen === String(current)}>
        {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {sending ? "Saving…" : "Save Assistant Lead"}
      </Button>
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Assistant Lead saved.
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
