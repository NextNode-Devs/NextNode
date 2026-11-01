"use client";

import { Loader2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeProposal } from "@/entities/start-gate";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  projectId: number;
  /** What happens next for this kind of project, said before the Lead commits. */
  isClientProject: boolean;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/** The Team Lead locks a full team's roster. It can't be reopened, so it asks first. */
export function CloseProposal({ projectId, isClientProject, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(null);
    const result = await closeProposal(api, projectId);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDone(true);
    router.refresh(); // the gate, roster and next step all change
  };

  if (done) {
    return (
      <p role="status" className="text-sm font-medium">
        Proposal closed. The team is locked.
      </p>
    );
  }

  const next = isClientProject
    ? "Next you'll send the client a signed offer."
    : "Next you'll finalise the timeline, which starts the project.";

  return (
    <div className="space-y-3">
      {confirming ? (
        <div role="group" aria-labelledby="close-proposal-confirm" className="space-y-3 rounded-lg border p-3">
          <p id="close-proposal-confirm" className="text-sm">
            <span className="font-medium">Close the proposal and lock the team?</span> Applications and invitations stop
            and can&apos;t be reopened. {next}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={submit} disabled={sending}>
              {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {sending ? "Closing…" : "Yes, close the proposal"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={() => setConfirming(true)}>
          <LockIcon aria-hidden /> Close the proposal
        </Button>
      )}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
