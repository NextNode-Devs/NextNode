"use client";

import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { getMyProjects, type ProjectCardData } from "@/entities/project";
import { inviteDeveloper } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

import { invitableTeams } from "../model/invitable-teams";

type Props = {
  developerId: number;
  developerName: string;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/**
 * "Invite to my team" on a developer's portfolio (Workflow B). Never the same
 * action as a client's "Invite to lead". Shown only to Team Leads with open
 * spots; nothing appears while their projects load or if they can't be loaded,
 * so there is never a control that can't work. Sending opens the new conversation.
 */
export function InviteToTeam({ developerId, developerName, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [projects, setProjects] = useState<ProjectCardData[] | null>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void getMyProjects(api).then((result) => {
      if (!current) return;
      const teams = result.ok ? invitableTeams(result.data, developerId) : [];
      setProjects(teams);
      if (teams.length === 1) setProjectId(String(teams[0].id));
    });
    return () => {
      current = false;
    };
  }, [api, developerId]);

  if (!projects?.length) return null;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon aria-hidden /> Invite to my team…
      </Button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) {
      setError("Choose the team you're inviting them to.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await inviteDeveloper(api, Number(projectId), developerId);
    if (result.ok) {
      router.push(result.data.conversation_id ? `/conversations/${result.data.conversation_id}` : `/projects/${projectId}`);
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
        Invite {developerName} to your team
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
              <span className="min-w-0 break-words">
                {project.title}{" "}
                <span className="text-muted-foreground">
                  ({project.open_spots} open {project.open_spots === 1 ? "spot" : "spots"})
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        They join only if they accept, in the conversation this opens.
      </p>
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
