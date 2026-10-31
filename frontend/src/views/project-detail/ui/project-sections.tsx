import { CalendarIcon, CrownIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { portfolioHref } from "@/entities/developer";
import { ProposedBudget, TechStack, type Project } from "@/entities/project";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Separator } from "@/shared/ui/shadcn/separator";

/** What the owner wrote: scope, stack, target date and (client projects only) the proposed budget. */
export function ProjectBrief({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>{project.kind === "client" ? "Scope" : "About this idea"}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed whitespace-pre-line">{project.description}</p>
        <Separator />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <dt className="text-muted-foreground">Tech stack</dt>
            <dd>
              <TechStack tech={project.tech_stack} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Target delivery</dt>
            <dd className="inline-flex items-center gap-1.5 font-medium">
              <CalendarIcon className="size-4" aria-hidden />
              {formatCalendarDate(project.target_delivery_date)}
            </dd>
          </div>
          {project.proposed_budget_cents !== undefined ? (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Budget</dt>
              <dd>
                <ProposedBudget cents={project.proposed_budget_cents} />
                <p className="text-xs text-muted-foreground">Negotiable. The accepted offer sets the final total.</p>
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

/** The project's one team: its Team Lead and, once the Lead sets a size (#5), the open spots. */
export function TeamCard({ project }: { project: Project }) {
  const { team, lead } = project;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Team</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <CrownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {lead ? (
            <p>
              <span className="text-muted-foreground">Team Lead: </span>
              <Link href={portfolioHref(lead.account_id)} className="font-medium underline-offset-4 hover:underline">
                {lead.display_name}
              </Link>
              {project.viewer.is_lead ? <span className="text-muted-foreground"> (you)</span> : null}
            </p>
          ) : (
            <p>
              <span className="font-medium">Looking for a Team Lead.</span>{" "}
              <span className="text-muted-foreground">The client hires one from the developers who apply.</span>
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            {team.size === null
              ? `${team.headcount} ${team.headcount === 1 ? "person" : "people"} so far. Teams have 5 to 7 people, Team Lead included.`
              : `${team.headcount} of ${team.size} people · ${team.open_spots} open ${team.open_spots === 1 ? "spot" : "spots"}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
