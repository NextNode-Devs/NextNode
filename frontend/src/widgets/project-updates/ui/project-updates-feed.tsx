import { MegaphoneIcon } from "lucide-react";
import Link from "next/link";

import { MilestoneStatusBadge, type Milestone } from "@/entities/milestone";
import { groupUpdatesByMilestone, UPDATE_AUTHOR_ROLE_LABEL, type ProjectUpdate, type UpdateGroup } from "@/entities/project-update";
import { PostUpdateForm } from "@/features/post-project-update";
import { formatMessageTime } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { SectionRule } from "@/shared/ui/molecules/section-rule";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  updates: readonly ProjectUpdate[];
  /** The project's milestones, to title each group. */
  milestones: readonly Milestone[];
  chatHref: string | null;
};

/** Groups shown before "Show earlier updates". */
const OPEN_GROUPS = 2;

function Post({ update }: { update: ProjectUpdate }) {
  return (
    <li className="flex gap-3 py-3.5">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
        {update.author.display_name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold">{update.author.display_name}</span>
          <Badge variant="secondary">{UPDATE_AUTHOR_ROLE_LABEL[update.author.role]}</Badge>
          <time dateTime={update.created_at} className="ml-auto text-xs text-muted-foreground">
            {formatMessageTime(update.created_at)}
          </time>
        </p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{update.body}</p>
      </div>
    </li>
  );
}

function Group({ group, milestones }: { group: UpdateGroup; milestones: readonly Milestone[] }) {
  const milestone = milestones.find((m) => m.sequence === group.milestone_sequence);
  const headingId = `updates-${group.milestone_sequence ?? "before"}`;
  return (
    <section aria-labelledby={headingId}>
      <SectionRule id={headingId} aside={milestone ? <MilestoneStatusBadge status={milestone.status} /> : null}>
        {group.milestone_sequence === null
          ? "Before work started"
          : `Milestone ${group.milestone_sequence}${milestone ? ` · ${milestone.title}` : ""}`}
      </SectionRule>
      <ol className="divide-y">
        {group.updates.map((update) => (
          <Post key={update.id} update={update} />
        ))}
      </ol>
    </section>
  );
}

/** The workspace's updates feed, grouped by milestone, newest first, with the box to post. */
export function ProjectUpdatesFeed({ updates, milestones, chatHref }: Props) {
  const groups = groupUpdatesByMilestone(updates);
  const shown = groups.slice(0, OPEN_GROUPS);
  const earlier = groups.slice(OPEN_GROUPS);
  const earlierCount = earlier.reduce((sum, group) => sum + group.updates.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <h2>Updates</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>
          News the client and the whole team should see: progress, demos, decisions. Newest first.
          {chatHref ? (
            <>
              {" "}
              For back-and-forth, use{" "}
              <Link href={chatHref} className="underline underline-offset-4 hover:text-foreground">
                Chat
              </Link>
              .
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PostUpdateForm />
        {groups.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <MegaphoneIcon className="size-5 text-muted-foreground" aria-hidden />
            <p className="font-medium">No updates yet</p>
            <p className="text-sm text-muted-foreground">Post the first one so the client knows how things are going.</p>
          </div>
        ) : null}
        {shown.map((group) => (
          <Group key={group.milestone_sequence ?? "before"} group={group} milestones={milestones} />
        ))}
        {earlier.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Show {earlierCount} earlier {earlierCount === 1 ? "update" : "updates"}
            </summary>
            {earlier.map((group) => (
              <Group key={group.milestone_sequence ?? "before"} group={group} milestones={milestones} />
            ))}
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
