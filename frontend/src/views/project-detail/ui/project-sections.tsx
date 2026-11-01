import { CalendarIcon } from "lucide-react";

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
