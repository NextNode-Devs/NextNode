import { ArrowLeftIcon, LockIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getProject } from "@/entities/project";
import { resignViewer } from "@/entities/team";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { LeadResignPanel } from "@/widgets/lead-resign";

type Props = { projectId: Promise<string> };

/** `/projects/[id]/team/sign-offer`: the approved new Lead signs the current offer (NN-38, prototype). */
export function LeadResignView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading the offer" />}>
          <ResignScreen projectId={projectId} />
        </Suspense>
      </main>
    </>
  );
}

const button = (href: string, label: string) => (
  <Button asChild variant="outline">
    <Link href={href}>{label}</Link>
  </Button>
);

async function ResignScreen({ projectId }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/team/sign-offer`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load this project" message={route.message} />;

  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Project not found"
        message="This link doesn't match a project on NextNode. It may be mistyped."
        action={button("/projects", "Browse projects")}
      />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="You can't view this project"
        message={result.error.message}
        action={button("/projects", "Browse projects")}
      />
    ) : (
      <LoadError title="We couldn't load this project" message={result.error.message} />
    );
  }

  const project = result.data;
  const teamHref = `/projects/${project.id}/team`;
  const viewer = resignViewer(project.viewer);
  if (!viewer) {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="Only the client and team can see this"
        message="Signing the offer is between the project's client and its Team Lead."
        action={button(`/projects/${project.id}`, "Back to the overview")}
      />
    );
  }
  if (project.kind !== "client") {
    return (
      <StateCard
        as="h1"
        icon={<UsersIcon aria-hidden />}
        title="There's no offer to sign on this project"
        message="Developer projects have no client or offer. The creator stays the Team Lead, with an Assistant Lead if they choose one."
        action={button(`/projects/${project.id}`, "Back to the overview")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={teamHref}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Team
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {viewer === "new_lead" ? "Sign the current offer" : "The new Lead signs the offer"}
        </h1>
        <p className="text-muted-foreground">{project.title}</p>
      </header>
      <PrototypeNotice>
        This screen shows a sample Lead change and offer, not this project&apos;s.
        {viewer === "new_lead" ? " You see it as the approved new Lead would." : ""} Signing is under construction and
        saves nothing.
      </PrototypeNotice>
      <LeadResignPanel projectId={project.id} viewer={viewer} />
    </div>
  );
}
