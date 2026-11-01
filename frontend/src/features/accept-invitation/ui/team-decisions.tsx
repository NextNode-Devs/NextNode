"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { candidacyStatusText, type TeamCandidacy, type TeamDecision } from "@/entities/team";
import { Button } from "@/shared/ui/shadcn/button";

import { useTeamDecisions } from "../model/use-team-decisions";

type Props = {
  candidacyId: string;
  myAccountId: number;
  /** The person on the other side of the conversation. */
  otherName: string;
};

/** Decisions that end a candidacy ask once more, saying what will happen. */
const CONFIRM: Partial<Record<TeamDecision, { question: string; yes: string }>> = {
  reject: { question: "Reject this application? The conversation will close.", yes: "Reject" },
  decline: { question: "Decline this invitation? The conversation will close.", yes: "Decline" },
  withdraw: { question: "Withdraw your application? You can apply once, and the conversation will close.", yes: "Withdraw" },
};

const labelFor = (decision: TeamDecision, candidacy: TeamCandidacy) => {
  switch (decision) {
    case "accept":
      return candidacy.kind === "application" ? "Accept application" : "Accept invitation";
    case "reject":
      return "Reject";
    case "withdraw":
      return "Withdraw application";
    case "decline":
      return "Decline";
  }
};

const DECISIONS: TeamDecision[] = ["accept", "reject", "withdraw", "decline"];

/**
 * Where this application or invitation to join a team stands, and what the viewer
 * can decide, inside its conversation. The server says who may do what: only the
 * Team Lead accepts an application, and only the invitee accepts an invitation.
 */
export function TeamDecisions({ candidacyId, myAccountId, otherName }: Props) {
  const { state, busy, error, decide } = useTeamDecisions(candidacyId);
  const [confirming, setConfirming] = useState<TeamDecision | null>(null);

  if (state.status === "loading") {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Loading the application…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="px-4 py-3 text-sm text-destructive">
        {state.message}
      </p>
    );
  }

  const { candidacy } = state;
  const available = DECISIONS.filter((d) => candidacy.actions[d]);
  const confirm = confirming ? CONFIRM[confirming] : undefined;
  const developerName = myAccountId === candidacy.developer_account_id ? "you" : otherName;

  const run = async (decision: TeamDecision) => {
    if (CONFIRM[decision] && confirming !== decision) {
      setConfirming(decision);
      return;
    }
    setConfirming(null);
    await decide(candidacy, decision);
  };

  return (
    <section aria-label="Team decision" className="space-y-3 border-b bg-muted/40 px-4 py-3">
      <p role="status" className="text-sm">
        {candidacyStatusText(candidacy, myAccountId, developerName)}{" "}
        <Link href={`/projects/${candidacy.project_id}`} className="font-medium underline underline-offset-4">
          View the project
        </Link>
      </p>

      {confirm && confirming ? (
        <div className="space-y-2 rounded-lg border bg-background p-3" role="group" aria-label="Confirm">
          <p className="text-sm font-medium">{confirm.question}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={busy !== null} onClick={() => void run(confirming)}>
              {busy === confirming ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {confirm.yes}
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((decision) => (
            <Button
              key={decision}
              variant={decision === "accept" ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => void run(decision)}
            >
              {busy === decision ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {labelFor(decision, candidacy)}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
