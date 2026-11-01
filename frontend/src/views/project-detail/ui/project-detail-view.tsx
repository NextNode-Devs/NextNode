import { ArrowLeftIcon, CircleCheckIcon, LockIcon, PencilIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getProject, KindBadge, StatusBadge, type Project } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { RealtimeProvider } from "@/shared/api/realtime";
import { authedServerApi } from "@/shared/api/server-client";
import { isAuthConfigured } from "@/shared/config/env.public";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { RequirementDocuments } from "@/widgets/requirement-documents";
import { TeamRoster } from "@/widgets/team-roster";

import { PrimaryAction } from "./primary-action";
import { ProjectChats } from "./project-chats";
import { ProjectBrief } from "./project-sections";

export type Notice = "created" | "saved" | null;

type Props = { projectId: Promise<string>; notice: Promise<Notice> };

/** `/projects/[id]`: a project's brief, its team and the viewer's one primary action. */
export function ProjectDetailView(props: Props) {
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
        <Suspense fallback={<LoadingCards count={2} label="Loading the project" />}>
          <ProjectScreen {...props} />
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

async function ProjectScreen({ projectId, notice }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return (
      <>
        <h1 className="sr-only">Project</h1>
        <LoadError title="We couldn't load this project" message={route.message} />
      </>
    );
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
  if (!result.ok && result.error.code === "FORBIDDEN") {
    return (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={searchLink} />
    );
  }
  if (!result.ok) {
    return (
      <>
        <h1 className="sr-only">Project</h1>
        <LoadError title="We couldn't load this project" message={result.error.message} />
      </>
    );
  }

  const project = result.data;
  const shown = project.viewer.is_owner ? await notice : null;
  const me = route.viewer.account;
  // Hire Lead happens on client projects, between their client and developers.
  const chats =
    project.kind === "client" && (project.viewer.is_owner || me.role === "developer") ? (
      <ProjectChats projectId={project.id} myAccountId={me.id} isOwner={project.viewer.is_owner} />
    ) : null;
  const page = (
    <div className="space-y-6">
      {shown ? <SavedNotice project={project} notice={shown} /> : null}
      <header className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <KindBadge kind={project.kind} />
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
            <p className="text-muted-foreground">
              {project.kind === "client" ? "Posted" : "Proposed"} by {project.owner.display_name}
            </p>
          </div>
          {project.viewer.can_edit ? (
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                <PencilIcon aria-hidden /> Edit
              </Link>
            </Button>
          ) : null}
        </div>
        {project.viewer.is_owner && !project.viewer.can_edit ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LockIcon className="size-4" aria-hidden />
            {project.lead && project.kind === "client"
              ? "Your brief is locked now that you've hired a Team Lead."
              : `This project is ${project.status} and can no longer be edited.`}
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <ProjectBrief project={project} />
          {project.kind === "client" && project.viewer.can_read_documents ? (
            <RequirementDocuments projectId={project.id} canUpload={project.viewer.can_upload_documents} />
          ) : project.kind === "client" ? (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              This project has private requirement documents for its client and team. You&apos;ll see them if you join.
            </p>
          ) : null}
        </div>
        <aside className="space-y-4">
          <PrimaryAction project={project} />
          <Suspense fallback={<LoadingCards count={1} label="Loading the team" />}>
            <TeamRoster project={project} />
          </Suspense>
        </aside>
      </div>
      {chats}
    </div>
  );
  // Live: hiring conversations and team decisions.
  return isAuthConfigured() ? <RealtimeProvider>{page}</RealtimeProvider> : page;
}

function SavedNotice({ project, notice }: { project: Project; notice: NonNullable<Notice> }) {
  const created = notice === "created";
  return (
    <Alert role="status" className="border-success/40">
      <CircleCheckIcon className="text-success" aria-hidden />
      <AlertTitle>{created ? "Project published" : "Changes saved"}</AlertTitle>
      <AlertDescription>
        {created && project.kind === "client"
          ? "Developers can find it in Projects and apply to lead it. Add requirement documents below if you have any."
          : created
            ? "You're its Team Lead. Developers can find it in Projects."
            : "This is how everyone sees your project now."}
      </AlertDescription>
    </Alert>
  );
}
