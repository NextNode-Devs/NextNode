"use client";

import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { inviteToLead, leadChatHref } from "@/entities/lead-candidacy";
import { getMyProjects, type ProjectCardData } from "@/entities/project";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { invitableProjects } from "../model/invitable-projects";

const NOTE_MAX = 1000;

type Props = {
  developerId: number;
  developerName: string;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/**
 * "Invite to lead" on a developer's portfolio, for clients (#4). Shown only when
 * the client has a posted project still without a Team Lead; nothing appears
 * while their projects load or if they can't be loaded, so there is never a
 * control that can't work. Sending opens the project's page at the new conversation.
 */
export function InviteToLead({ developerId, developerName, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [projects, setProjects] = useState<ProjectCardData[] | null>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void getMyProjects(api).then((result) => {
      if (!current) return;
      const open = result.ok ? invitableProjects(result.data) : [];
      setProjects(open);
      if (open.length === 1) setProjectId(String(open[0].id));
    });
    return () => {
      current = false;
    };
  }, [api]);

  if (!projects?.length) return null;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon aria-hidden /> Invite to lead…
      </Button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) {
      setError("Choose the project you're inviting them to lead.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await inviteToLead(api, Number(projectId), developerId, note.trim());
    if (result.ok) {
      // The project's page, with this developer's conversation open.
      router.push(leadChatHref(Number(projectId), result.data.id));
      return; // keep "Sending…" until the page opens
    }
    setSending(false);
    setError(result.error.message);
  };

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="w-full space-y-3 rounded-xl border bg-card p-4 sm:w-80"
    >
      <h2 id={`${id}-title`} className="font-medium">
        Invite {developerName} to lead
      </h2>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Project</legend>
        <RadioGroup
          value={projectId}
          onValueChange={(next) => {
            if (next) setProjectId(next);
          }}
          disabled={sending}
          aria-invalid={Boolean(error && !projectId)}
        >
          {projects.map((project) => (
            <label
              key={project.id}
              htmlFor={`${id}-p${project.id}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <RadioGroupItem id={`${id}-p${project.id}`} value={String(project.id)} className="mt-0.5" />
              <span className="min-w-0 break-words">{project.title}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="space-y-2">
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder="Why you'd like them to lead it"
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          They can accept or decline in the conversation this opens. You still choose who to hire.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {sending ? "Sending…" : "Send invitation"}
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
