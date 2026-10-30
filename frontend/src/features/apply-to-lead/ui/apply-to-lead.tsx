"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { applyToLead } from "@/entities/lead-candidacy";
import { useApiClient } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

const NOTE_MAX = 1000;

type Props = { projectId: number };

/**
 * "Apply to lead" for a client-funded project's page (#3 mounts it in its
 * detail action slot for developers). Opens the conversation with the client.
 */
export function ApplyToLead({ projectId }: Props) {
  const api = useApiClient();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Apply to lead</Button>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    const result = await applyToLead(api, projectId, note.trim());
    if (result.ok && result.data.conversation_id) {
      router.push(`/conversations/${result.data.conversation_id}`);
      return; // keep "Applying…" until the conversation opens
    }
    setSending(false);
    setError(result.ok ? "Applied, but the conversation couldn't be opened." : result.error.message);
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={`${id}-note`} className="text-sm font-medium">
        Note to the client <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id={`${id}-note`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder="Why you'd be a good Team Lead for this project"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        You can apply once. The client decides in the conversation this opens.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {sending ? "Applying…" : "Send application"}
        </Button>
        <Button type="button" variant="outline" disabled={sending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
