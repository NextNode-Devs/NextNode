import { CalendarIcon, CrownIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatCalendarDate } from "@/shared/lib/format-date";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { projectHref, type ProjectCard as ProjectCardData } from "../model/project";
import { KindBadge, ProposedBudget, StatusBadge, TechStack } from "./project-bits";

type Props = {
  project: ProjectCardData;
  /** Extra badge, e.g. the viewer's part in the project on the dashboard. */
  badge?: ReactNode;
  showStatus?: boolean;
};

/** A project in search results and on the dashboard. The title links to the detail page. */
export function ProjectCard({ project, badge, showStatus = false }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <KindBadge kind={project.kind} />
          {showStatus ? <StatusBadge status={project.status} /> : null}
          {badge}
        </div>
        <CardTitle className="text-base leading-snug">
          <Link
            href={projectHref(project.id)}
            className="underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">by {project.owner.display_name}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <TechStack tech={project.tech_stack} />
        {project.proposed_budget_cents !== undefined ? <ProposedBudget cents={project.proposed_budget_cents} /> : null}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="size-3.5" aria-hidden /> Target {formatCalendarDate(project.target_delivery_date)}
        </span>
        {project.lead ? (
          <span className="inline-flex items-center gap-1">
            <CrownIcon className="size-3.5" aria-hidden /> Lead: {project.lead.display_name}
          </span>
        ) : project.needs_lead ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <CrownIcon className="size-3.5" aria-hidden /> Needs a Team Lead
          </span>
        ) : null}
        {project.open_spots > 0 ? (
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" aria-hidden /> {project.open_spots} open{" "}
            {project.open_spots === 1 ? "spot" : "spots"}
          </span>
        ) : null}
      </CardFooter>
    </Card>
  );
}
