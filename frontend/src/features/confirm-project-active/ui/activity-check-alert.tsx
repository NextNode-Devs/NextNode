"use client";

import { CircleHelpIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { confirmProjectActive, type ActivityCheck } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  projectId: number;
  check: ActivityCheck;
  /** The viewer may answer: a member, or the Team Lead themselves. */
  canConfirm: boolean;
  isLead: boolean;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/**
 * "Is this project still active?" (NN-39), asked after 30 days without a
 * message from the Team Lead in the project chat. The first member to answer
 * yes becomes Assistant Lead if there is none; with no answer, the project closes.
 */
export function ActivityCheckAlert({ projectId, check, canConfirm, isLead, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSending(true);
    setError(null);
    const result = await confirmProjectActive(api, projectId);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };

  const deadline = formatMessageTime(check.answer_by);
  return (
    // A standing question, not an error: "status", so the refusal below stays the only alert.
    <Alert role="status" className="border-warning/50">
      <CircleHelpIcon aria-hidden />
      <AlertTitle>
        <h2>{check.question}</h2>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {isLead
            ? "You haven't written in the project chat for 30 days, so your members are being asked. Answer here, or send a message in the project chat."
            : "The Team Lead hasn't written in the project chat for 30 days. Confirm if you're still working on it. The first member to confirm becomes Assistant Lead if the team has none."}
        </p>
        <p>
          While we wait, the project is hidden from the open-projects feed. If nobody confirms by{" "}
          <strong className="font-medium">{deadline}</strong>, the project is closed.
        </p>
        {canConfirm ? (
          <Button size="sm" onClick={confirm} disabled={sending}>
            {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {sending ? "Saving…" : "Yes, it's still active"}
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
