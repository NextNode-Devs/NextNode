import { CheckIcon, CircleDotIcon, CircleIcon, UsersIcon } from "lucide-react";

import { activeSeats, openSpots, type TeamChangesSnapshot, type TeamViewer } from "@/entities/team";
import { LeadProposalDecision } from "@/features/decide-lead-proposal";
import { ReplacementPicker } from "@/features/pick-replacement";
import { ProposeLeadForm } from "@/features/propose-new-lead";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = { snapshot: TeamChangesSnapshot; viewer: TeamViewer };

/** What the team is waiting for in this situation, and the viewer's part in it. */
export function NextStepCard({ snapshot, viewer }: Props) {
  const lead = snapshot.seats.find((s) => s.role === "lead");
  const leadName = lead?.display_name ?? "The Team Lead";
  const { title, body } = content(snapshot, viewer, leadName);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{body}</CardContent>
    </Card>
  );
}

function content(snapshot: TeamChangesSnapshot, viewer: TeamViewer, leadName: string) {
  const members = activeSeats(snapshot.seats).filter((s) => s.role === "member");
  switch (snapshot.situation) {
    case "member_left": {
      const spots = openSpots(snapshot);
      return {
        title: `${spots} open ${spots === 1 ? "spot" : "spots"}`,
        body:
          viewer === "lead" ? (
            <ReplacementPicker candidates={snapshot.candidates} asOf={snapshot.as_of} />
          ) : (
            <p className="text-muted-foreground">
              {leadName} is choosing a replacement from {snapshot.candidates.length} applicants and invited developers.
              {viewer === "client" ? " You'll be told who joins." : " Everyone is told who joins."}
            </p>
          ),
      };
    }
    case "lead_unresponsive":
      return {
        title: "Choosing a new Lead",
        body:
          viewer === "member" ? (
            <ProposeLeadForm members={members} />
          ) : (
            <p className="text-muted-foreground">
              {viewer === "client"
                ? "No proposal yet. When the team proposes a member, you approve or decline them here."
                : "If the team proposes a new Lead and the client approves, you stop being the Lead and lose access."}
            </p>
          ),
      };
    case "lead_proposed": {
      const proposal = snapshot.proposal;
      if (!proposal) break;
      const name = proposal.candidate.display_name;
      return {
        title: "New Lead proposed",
        body: (
          <>
            <Steps
              steps={[
                { label: `${proposal.proposed_by} proposed ${name}`, state: "done" },
                { label: "The client approves", state: "current" },
                { label: `${name} signs offer version ${proposal.offer_version}`, state: "todo" },
              ]}
            />
            {viewer === "client" ? (
              <LeadProposalDecision proposal={proposal} currentLead={leadName} />
            ) : (
              <p className="text-muted-foreground">Waiting for the client to approve {name}.</p>
            )}
          </>
        ),
      };
    }
    default:
      break;
  }
  return {
    title: "No changes needed",
    body: (
      <p className="flex items-start gap-2 text-muted-foreground">
        <UsersIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Everyone is on board. If someone leaves, or the Lead doesn&apos;t respond for 3 days, the next step shows here.
      </p>
    ),
  };
}

type Step = { label: string; state: "done" | "current" | "todo" };

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const Icon = step.state === "done" ? CheckIcon : step.state === "current" ? CircleDotIcon : CircleIcon;
        return (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn("flex items-start gap-2", step.state === "todo" && "text-muted-foreground")}
          >
            <Icon
              className={cn("mt-0.5 size-4 shrink-0", step.state === "done" && "text-success", step.state === "current" && "text-warning")}
              aria-hidden
            />
            <span>
              <span className="sr-only">
                Step {index + 1}, {step.state === "done" ? "done" : step.state === "current" ? "now" : "next"}:{" "}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
