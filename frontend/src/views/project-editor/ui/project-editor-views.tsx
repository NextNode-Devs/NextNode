import { ArrowLeftIcon, LockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { EditProjectForm } from "@/features/edit-project";
import { PostBriefForm } from "@/features/post-project-brief";
import { ProposeIdeaForm } from "@/features/propose-project-idea";
import { getProject, projectHref } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";

function Page({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> {back.label}
        </Link>
        <Suspense fallback={<LoadingCards count={1} label="Loading the form" />}>{children}</Suspense>
      </main>
    </>
  );
}

/** `/projects/new`: a client posts a brief; a developer proposes an idea. Each role sees only its own kind. */
export function NewProjectView() {
  return (
    <Page back={{ href: "/projects", label: "All projects" }}>
      <NewProject />
    </Page>
  );
}

async function NewProject() {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect("/sign-in?redirect_url=/projects/new");
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't open the form" message={route.message} />;

  const client = route.viewer.account.role === "client";
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {client ? "Post a project brief" : "Propose a project idea"}
        </h1>
        <p className="text-muted-foreground">
          {client
            ? "Describe what you need. Developers apply to lead it, and you hire one Team Lead who builds the team."
            : "Share something you want to build. You'll be its Team Lead and can recruit a team of 5 to 7 people. Ideas have no budget or payments."}
        </p>
      </header>
      {client ? <PostBriefForm /> : <ProposeIdeaForm />}
    </div>
  );
}

/** `/projects/[id]/edit`: the owner, while the project may still be edited. */
export function EditProjectView({ projectId }: { projectId: Promise<string> }) {
  return (
    <Page back={{ href: "/projects", label: "All projects" }}>
      <EditProject projectId={projectId} />
    </Page>
  );
}

async function EditProject({ projectId }: { projectId: Promise<string> }) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/edit`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't open this project" message={route.message} />;

  const result = /^\d+$/.test(id) ? await getProject(authedServerApi, Number(id)) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Project not found"
        message="This link doesn't match a project on NextNode."
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Browse projects</Link>
          </Button>
        }
      />
    );
  }
  if (!result.ok) return <LoadError title="We couldn't open this project" message={result.error.message} />;

  const project = result.data;
  if (!project.viewer.can_edit) {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="You can't edit this project"
        message={
          !project.viewer.is_owner
            ? "Only the person who published a project can edit it."
            : project.lead && project.kind === "client"
              ? "Your brief is locked now that you've hired a Team Lead."
              : `This project is ${project.status} and can no longer be edited.`
        }
        action={
          <Button asChild variant="outline">
            <Link href={projectHref(project.id)}>Back to the project</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Edit project</h1>
        <p className="text-muted-foreground">{project.title}</p>
      </header>
      <EditProjectForm project={project} />
    </div>
  );
}
