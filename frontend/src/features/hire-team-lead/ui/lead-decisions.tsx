"use client";

import { CrownIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { leadStatusText, type LeadDecision } from "@/entities/lead-candidacy";
import { Button } from "@/shared/ui/shadcn/button";

import { useLeadDecisions } from "../model/use-lead-decisions";

type Props = {
  candidacyId: string;
  myAccountId: number;
  /** The developer's name, for the client's sentences. */
  developerName: string;
};

/** Decisions that can't be undone ask once more, saying what will happen. */
const CONFIRM: Partial<Record<LeadDecision, (name: string) => { question: string; yes: string }>> = {
  hire: (name) => ({
    question: `Hire ${name} as Team Lead? Every other candidate's conversation for this project will close.`,
    yes: `Hire ${name}`,
  }),
  decline: () => ({ question: "Decline this invitation? The conversation will close.", yes: "Decline" }),
  withdraw: () => ({ question: "Withdraw your application? The conversation will close.", yes: "Withdraw" }),
};

const LABEL: Record<LeadDecision, string> = {
  accept: "Accept invitation",
  decline: "Decline",
  withdraw: "Withdraw application",
  hire: "Hire as Team Lead",
};

/** Where this application or invitation stands, and what the viewer can decide, inside its conversation. */
export function LeadDecisions({ candidacyId, myAccountId, developerName }: Props) {
  const { state, busy, error, decide } = useLeadDecisions(candidacyId);
  const [confirming, setConfirming] = useState<LeadDecision | null>(null);

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
  const available = (Object.keys(LABEL) as LeadDecision[]).filter((d) => candidacy.actions[d]);
  const confirm = confirming ? CONFIRM[confirming]?.(developerName) : undefined;

  const run = async (decision: LeadDecision) => {
    if (CONFIRM[decision] && confirming !== decision) {
      setConfirming(decision);
      return;
    }
    setConfirming(null);
    await decide(decision);
  };

  return (
    <section aria-label="Hiring decision" className="space-y-3 border-b bg-muted/40 px-4 py-3">
      <p role="status" className="flex items-start gap-2 text-sm">
        {candidacy.status === "hired" ? <CrownIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
        <span>{leadStatusText(candidacy, myAccountId, developerName)}</span>
      </p>
      {candidacy.note ? (
        <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">“{candidacy.note}”</blockquote>
      ) : null}

      {confirm && confirming ? (
        <div className="space-y-2 rounded-lg border bg-background p-3" role="group" aria-label="Confirm">
          <p className="text-sm font-medium">{confirm.question}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={confirming === "hire" ? "default" : "destructive"}
              disabled={busy !== null}
              onClick={() => void run(confirming)}
            >
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
              variant={decision === "hire" || decision === "accept" ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => void run(decision)}
            >
              {busy === decision ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {LABEL[decision]}
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
