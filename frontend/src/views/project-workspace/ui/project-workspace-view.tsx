import { ArrowLeftIcon, LockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getProject, KindBadge, StatusBadge } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { isInWorkspace, ProjectTabs, type WorkspaceTab } from "@/widgets/project-tabs";

import { ChatTab, DocumentsTab, MembersOnly, UpdatesTab, MeetingsTab } from "./tab-content";

type Props = { projectId: Promise<string>; tab: WorkspaceTab };

const TITLE: Record<WorkspaceTab, string> = {
  chat: "Chat",
  documents: "Documents",
  meetings: "Meetings",
  updates: "Updates",
};

/** `/projects/[id]/{chat,documents,meetings,updates}`: the project's workspace tabs (#92). */
export function ProjectWorkspaceView(props: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> All projects
        </Link>
        <Suspense fallback={<LoadingCards count={2} label={`Loading ${TITLE[props.tab].toLowerCase()}`} />}>
          <WorkspaceScreen {...props} />
        </Suspense>
      </main>
    </>
  );
}

const searchLink = (
  <Button asChild variant="outline">
    <Link href="/projects">Browse projects</Link>
  </Button>
);

async function WorkspaceScreen({ projectId, tab }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/${tab}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return <LoadError title="We couldn't load this project" message={route.message} />;
  }

  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Project not found"
        message="This link doesn't match a project on NextNode. It may be mistyped."
        action={searchLink}
      />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={searchLink} />
    ) : (
      <LoadError title="We couldn't load this project" message={result.error.message} />
    );
  }

  const project = result.data;
  const myAccountId = route.viewer.account.id;
  // Read after the request data above, so it is per-request (never prerendered).
  const now = new Date().toISOString();
  const props = { project, myAccountId };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <KindBadge kind={project.kind} />
          <StatusBadge status={project.status} />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {project.title}
            <span className="sr-only">: {TITLE[tab]}</span>
          </h1>
          <p className="text-muted-foreground">
            {project.kind === "client" ? "Posted" : "Proposed"} by {project.owner.display_name}
          </p>
        </div>
      </header>
      <ProjectTabs project={project} current={tab} />
      {!isInWorkspace(project) ? (
        <MembersOnly project={project} viewerRole={route.viewer.account.role} />
      ) : tab === "chat" ? (
        <ChatTab {...props} />
      ) : tab === "documents" ? (
        <DocumentsTab {...props} />
      ) : tab === "meetings" ? (
        <MeetingsTab {...props} now={now} />
      ) : (
        <UpdatesTab {...props} now={now} />
      )}
    </div>
  );
}
