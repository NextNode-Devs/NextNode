"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { applyToJoin, candidacyHref, getMyTeamCandidacies, TEAM_UPDATED, type MyTeamCandidacy } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";
import { Button } from "@/shared/ui/shadcn/button";

import { standingOn } from "../model/standing";

type Props = {
  projectId: number;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

const sentence = (item: MyTeamCandidacy) => {
  if (item.status === "pending") {
    return item.kind === "invitation"
      ? "The Team Lead has invited you to this team."
      : "You've applied to join this team. The Team Lead decides.";
  }
  return item.closed_reason ? `Your application ended: ${item.closed_reason}.` : "You've already applied to this team.";
};

/** "Apply to join" (Workflow B) in the project page's action slot. Not applying
 * to *lead* a project: that is #4's. Opens the conversation with the Team Lead. */
export function ApplyToJoin({ projectId, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const { connection } = useRealtime();
  const [status, setStatus] = useState<"checking" | "ready">("checking");
  const [standing, setStanding] = useState<MyTeamCandidacy | undefined>();
  const [justApplied, setJustApplied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getMyTeamCandidacies(api);
    if (result.ok) setStanding(standingOn(result.data, projectId));
    setStatus("ready");
  }, [api, projectId]);

  useEffect(() => {
    let current = true;
    void getMyTeamCandidacies(api).then((result) => {
      if (!current) return;
      if (result.ok) setStanding(standingOn(result.data, projectId));
      setStatus("ready");
    });
    return () => {
      current = false;
    };
  }, [api, projectId]);

  // The Team Lead's decision arrives live.
  useEffect(() => {
    if (!connection) return;
    return connection.on(TEAM_UPDATED, (frame) => {
      if (frame.project_id === projectId) void load();
    });
  }, [connection, load, projectId]);

  if (status === "checking") return <p className="text-sm text-muted-foreground">Checking your application…</p>;

  if (standing) {
    return (
      <p role="status" className="text-sm">
        {justApplied && standing.status === "pending" ? "Application sent. The Team Lead decides." : sentence(standing)}{" "}
        <Link href={candidacyHref(standing)} className="font-medium underline underline-offset-4">
          Open the conversation
        </Link>
      </p>
    );
  }

  const apply = async () => {
    setSending(true);
    setError(null);
    const result = await applyToJoin(api, projectId);
    setSending(false);
    if (result.ok) {
      setJustApplied(true);
      await load();
      return;
    }
    setError(result.error.message);
  };

  return (
    <div className="space-y-2">
      <Button onClick={() => void apply()} disabled={sending}>
        {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {sending ? "Applying…" : "Apply to join"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
