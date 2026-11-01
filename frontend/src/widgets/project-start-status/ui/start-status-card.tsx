import { MessagesSquareIcon, RocketIcon } from "lucide-react";
import Link from "next/link";

import { nextActorLabel, type StartGate } from "@/entities/start-gate";
import { DecideOffer } from "@/features/accept-offer";
import { CloseProposal } from "@/features/close-proposal";
import { FinalizeTimelineForm } from "@/features/finalize-timeline";
import { PayDepositCard } from "@/features/make-deposit";
import { SendOfferForm } from "@/features/send-offer";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { OfferHistory } from "./offer-history";
import { StartSteps } from "./start-steps";

type Props = {
  gate: StartGate;
  /** A developer idea's own target date, the timeline form's starting value. */
  targetDeliveryDate: string;
};

/**
 * The start gate on a project's page: each condition, whose turn it is, and
 * the viewer's one action. Members see the same status, read-only.
 */
export function StartStatusCard({ gate, targetDeliveryDate }: Props) {
  const yourTurn = gate.next_actor === gate.viewer_role;
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            <h2>Project start</h2>
          </CardTitle>
          <Badge variant={gate.started ? "default" : yourTurn ? "secondary" : "outline"}>
            {nextActorLabel(gate.next_actor, gate.viewer_role)}
          </Badge>
        </div>
        <CardDescription>
          {gate.kind === "client"
            ? "Work starts once the team is locked, the client accepts the Team Lead's offer and Stripe confirms the deposit."
            : "Work starts once the team is locked and the Team Lead finalises the timeline. No payment applies."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <StartSteps conditions={gate.conditions} />
        {gate.started ? <Started gate={gate} /> : <NextStep gate={gate} yourTurn={yourTurn} />}
        <Action gate={gate} targetDeliveryDate={targetDeliveryDate} />
        {gate.timeline ? (
          <p className="text-sm text-muted-foreground">
            Timeline: {formatCalendarDate(gate.timeline.start_date)} to{" "}
            {formatCalendarDate(gate.timeline.delivery_date)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NextStep({ gate, yourTurn }: { gate: StartGate; yourTurn: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
      <p className="text-sm">
        <span className="font-medium">{yourTurn ? "Your next step: " : "Next: "}</span>
        {gate.next_step}
      </p>
      {/* The other side's actions arrive on their next load; this checks now. */}
      {yourTurn ? null : <RefreshButton label="Check for updates" />}
    </div>
  );
}

function Started({ gate }: { gate: StartGate }) {
  const chat = gate.workspace_conversation_id;
  return (
    <Alert role="status" className="border-success/40">
      <RocketIcon className="text-success" aria-hidden />
      <AlertTitle>Work has started</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {gate.viewer_role === "client"
            ? "Your team is active. Keep talking to your Team Lead in your existing chat."
            : "The team is active and has its own workspace chat. The client isn't in it."}
        </p>
        {chat ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/conversations/${chat}`}>
              <MessagesSquareIcon aria-hidden /> Open the team workspace chat
            </Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** The one thing this viewer can do now, plus the offer history on client projects. */
function Action({ gate, targetDeliveryDate }: Props) {
  const offers = gate.offers ?? [];
  const latest = offers[0];
  const accepted = offers.find((offer) => offer.status === "accepted");
  const can = (action: StartGate["actions"][number]) => gate.actions.includes(action);
  return (
    <>
      {can("close_proposal") ? (
        <CloseProposal projectId={gate.project_id} isClientProject={gate.kind === "client"} />
      ) : null}
      {can("finalize_timeline") ? (
        <FinalizeTimelineForm projectId={gate.project_id} targetDeliveryDate={targetDeliveryDate} />
      ) : null}
      {can("send_offer") && gate.proposed_budget_cents !== null ? (
        <SendOfferForm
          projectId={gate.project_id}
          proposedBudgetCents={gate.proposed_budget_cents}
          declined={latest?.status === "declined" ? latest : undefined}
        />
      ) : null}
      {can("pay_deposit") && accepted && gate.deposit_percent !== null ? (
        <PayDepositCard
          projectId={String(gate.project_id)}
          isProjectClient
          projectKind="client"
          projectStatus={gate.project_status}
          depositCents={accepted.deposit_cents}
          offerTotalCents={accepted.total_cents}
          depositPercent={gate.deposit_percent}
          currency={accepted.currency}
        />
      ) : null}
      {offers.length > 0 ? (
        <OfferHistory offers={offers} proposedBudgetCents={gate.proposed_budget_cents}>
          {can("decide_offer") && latest?.status === "sent" ? <DecideOffer offer={latest} /> : null}
        </OfferHistory>
      ) : null}
    </>
  );
}
