import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { getMyProjects, projectHref, StatusBadge, type MyProject } from "@/entities/project";
import type { Role } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";

const ROLE_BADGE: Record<MyProject["my_role"], string> = { owner: "Yours", lead: "Team Lead", member: "Member" };

/** The dashboard's "My projects": a client's briefs; a developer's ideas and teams. */
export async function MyProjects({ role, limit = 5 }: { role: Role; limit?: number }) {
  const result = await getMyProjects(authedServerApi);
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We couldn&apos;t load your projects. {result.error.message}
      </p>
    );
  }
  const newLabel = role === "client" ? "Post a project brief" : "Propose a project idea";
  if (result.data.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {role === "client"
            ? "You haven't posted a project yet. Post a brief and developers can apply to lead it."
            : "You don't lead or belong to a project yet. Propose your own idea, or find one to join."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/projects/new">
              <PlusIcon aria-hidden /> {newLabel}
            </Link>
          </Button>
          {role === "developer" ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/projects">Browse projects</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  const shown = result.data.slice(0, limit);
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {shown.map(({ project, my_role }) => (
          <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0 space-y-0.5">
              <Link href={projectHref(project.id)} className="block truncate text-sm font-medium underline-offset-4 hover:underline">
                {project.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {project.lead ? `Team Lead: ${project.lead.display_name}` : project.needs_lead ? "Needs a Team Lead" : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              {role === "developer" ? <Badge variant="secondary">{ROLE_BADGE[my_role]}</Badge> : null}
              <StatusBadge status={project.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/projects/new" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
          <PlusIcon className="size-4" aria-hidden /> {newLabel}
        </Link>
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
          Browse projects <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
