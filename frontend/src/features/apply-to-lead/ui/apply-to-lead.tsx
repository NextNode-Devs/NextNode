"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import { applyToLead, getProjectLeadChats } from "@/entities/lead-candidacy";
import { useApiClient } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { alreadyInvolved } from "../model/already-involved";

const NOTE_MAX = 1000;

type Props = { projectId: number };

/**
 * "Apply to lead" for a client-funded project's page (#3 mounts it in its
 * detail action slot for developers). Applying opens the conversation with the
 * client, shown further down the same page; once applied, the button gives way
 * to a pointer to it.
 */
export function ApplyToLead({ projectId }: Props) {
  const api = useApiClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [involved, setInvolved] = useState(false);

  useEffect(() => {
    let current = true;
    void getProjectLeadChats(api, projectId).then((result) => {
      if (current && result.ok && alreadyInvolved(result.data)) setInvolved(true);
    });
    return () => {
      current = false;
    };
  }, [api, projectId]);

  if (involved) {
    return (
      <p role="status" className="text-sm">
        You&apos;re talking with the client about leading this project.{" "}
        <a href="#hiring" className="font-medium underline underline-offset-4">
          Open the conversation
        </a>
      </p>
    );
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Apply to lead</Button>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    const result = await applyToLead(api, projectId, note.trim());
    setSending(false);
    if (result.ok) {
      setInvolved(true); // the conversation appears below as the socket announces it
      return;
    }
    setError(result.error.message);
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
