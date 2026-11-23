import { FolderOpenIcon, LockIcon, MegaphoneIcon } from "lucide-react";
import Link from "next/link";

import { PROJECT_ROLE_LABEL, ProjectRoleBadge, StatusBadge, type DashboardProject } from "@/entities/project";
import { UPDATE_AUTHOR_ROLE_LABEL, type ProjectUpdate } from "@/entities/project-update";
import { formatMessageTime } from "@/shared/lib/format-date";
import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";

import { latestUpdateFor, type RoleFilter } from "../model/overview";

type Props = { projects: DashboardProject[]; updates: readonly ProjectUpdate[]; filter: RoleFilter };

/** Every project with the viewer's role on it and its latest update. */
export function ProjectRows({ projects, updates, filter }: Props) {
  if (projects.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <FolderOpenIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {filter === "all"
          ? "No projects yet. Projects you post, lead or join will appear here."
          : `No projects where you're ${PROJECT_ROLE_LABEL[filter]}.`}
      </p>
    );
  }
  return (
    <ul aria-label="Your projects" className="divide-y rounded-lg border">
      {projects.map((item) => (
        <li key={item.project.id} className="space-y-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-medium break-words">{item.project.title}</p>
            <span className="flex flex-wrap gap-1.5">
              <ProjectRoleBadge role={item.role} />
              <StatusBadge status={item.project.status} />
            </span>
          </div>
          {item.has_access ? (
            <Accessible item={item} update={latestUpdateFor(item.project.id, updates)} />
          ) : (
            <NoAccess projectId={item.project.id} title={item.project.title} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Accessible({ item, update }: { item: DashboardProject; update: ProjectUpdate | undefined }) {
  return (
    <>
      {update ? (
        <p className="flex items-start gap-2 text-sm">
          <MegaphoneIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="sr-only">Latest update: </span>
            <span className="line-clamp-2">{update.body}</span>
            <span className="block text-xs text-muted-foreground">
              {update.author.display_name} ({UPDATE_AUTHOR_ROLE_LABEL[update.author.role]}) · {formatMessageTime(update.created_at)}
            </span>
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No updates yet.</p>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => underConstruction("Open sample project")}
        aria-label={`Open ${item.project.title}`}
      >
        Open project
      </Button>
    </>
  );
}

/** Permission denied: whoever leaves a team loses access straight away (stakeholder Q2). */
function NoAccess({ projectId, title }: { projectId: number; title: string }) {
  return (
    <>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        You&apos;re no longer on this team, so its chat, files and updates are closed to you.
      </p>
      {/* NN-38 (Aliya): the access-lost screen explains why and what stays. */}
      <Button asChild size="sm" variant="outline">
        <Link href={`/projects/${projectId}/no-access`}>
          Why can&apos;t I open this?<span className="sr-only"> ({title})</span>
        </Link>
      </Button>
    </>
  );
}
