import type { Project } from "@/entities/project";
import { ContactSupportButton } from "@/features/contact-support";
import { RaiseTeamIssueButton } from "@/features/raise-team-issue";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";

import { helpRoute, type HelpRoute } from "../model/help-route";

const MESSAGE: Record<HelpRoute["kind"], string> = {
  "raise-with-lead": "Disagreements inside the team go to your Team Lead first. If that doesn't sort it out, contact support.",
  "no-lead": "This project has no Team Lead right now, so issues can't be raised inside the team. Contact support if something needs attention.",
  lead: "Team members raise issues with you, and you work them out inside the team. If one needs to go further, contact support.",
  client: "Questions about the work go to the Team Lead in your conversation with them. If a dispute can't be resolved with them, contact support.",
};

/**
 * "Something not right?" (NN-40, stakeholder Q5): the workspace's escalation
 * entry points, worded for each role. PROTOTYPE: both actions open dialogs
 * that send nothing.
 */
export function WorkspaceHelpCard({ project }: { project: Project }) {
  const route = helpRoute(project);
  if (!route) return null;

  return (
    <section aria-labelledby="workspace-help-heading" className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workspace-help-heading" className="text-base font-semibold">
          Something not right?
        </h2>
        <PrototypeBadge />
      </div>
      <p className="text-sm text-muted-foreground">{MESSAGE[route.kind]}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {route.kind === "raise-with-lead" ? <RaiseTeamIssueButton leadName={route.leadName} /> : null}
        <ContactSupportButton />
      </div>
    </section>
  );
}
