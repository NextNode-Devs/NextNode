import { ArrowLeftIcon, LockIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { parseDirectoryParams, SAMPLE_HIRE_DEVS_POOL } from "@/entities/developer";
import { getProject, projectHref, TechStack, type Project } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { DeveloperFilters } from "@/features/filter-developers";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { AppHeader } from "@/widgets/app-header";

import { hireDevsAccess, hireDevsPath, rankDevelopers } from "../model/hire-devs";
import { HireDevsResults } from "./hire-devs-results";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { projectId: Promise<string>; searchParams: Promise<SearchParams> };

/**
 * `/projects/[id]/hire-devs` (PROTOTYPE, NN-33 #91): the Team Lead's Hire Devs
 * screen. The shared developer filters (#93) narrow sample developers, each
 * ranked by a rule-based match against the project's real tech stack.
 * Real invitations still happen from a developer's portfolio (Phase 1, #5).
 */
export function HireDevsView(props: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <LoadingCards count={4} label="Loading developers" />
            </>
          }
        >
          <HireDevsScreen {...props} />
        </Suspense>
      </main>
    </>
  );
}

const projectsLink = (
  <Button asChild variant="outline">
    <Link href="/projects">Browse projects</Link>
  </Button>
);

function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeftIcon className="size-4" aria-hidden /> {children}
    </Link>
  );
}

async function HireDevsScreen({ projectId, searchParams }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/hire-devs`);
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
        action={projectsLink}
      />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={projectsLink} />
    ) : (
      <LoadError title="We couldn't load this project" message={result.error.message} />
    );
  }

  const project = result.data;
  const back = <BackLink href={projectHref(project.id)}>{project.title}</BackLink>;
  const blocked = blockedState(project);
  if (blocked) {
    return (
      <>
        {back}
        {blocked}
      </>
    );
  }

  const filters = parseDirectoryParams(await searchParams);
  const basePath = hireDevsPath(project.id);
  const matches = rankDevelopers(SAMPLE_HIRE_DEVS_POOL, project, filters);
  return (
    <>
      {back}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hire developers</h1>
          <PrototypeBadge />
        </div>
        <p className="text-muted-foreground">
          Find developers for {project.title}. Matches are suggestions; you choose who to invite.
        </p>
        <div className="space-y-1.5 text-sm">
          <p className="text-muted-foreground">Required skills (your tech stack)</p>
          <TechStack tech={project.tech_stack} />
        </div>
      </header>
      <PrototypeNotice title="Prototype: sample developers">
        The developers below are sample profiles, scored against your project&apos;s real tech stack. Invite and View
        portfolio are under construction. To invite a real developer, open their portfolio from{" "}
        <Link href="/developers" className="font-medium underline underline-offset-4">
          Developers
        </Link>
        .
      </PrototypeNotice>
      <DeveloperFilters initial={filters} basePath={basePath} />
      <HireDevsResults matches={matches} filters={filters} basePath={basePath} requiredCount={project.tech_stack.length} />
    </>
  );
}

/** Permission denied, or a team that isn't recruiting: says why and offers the way back. */
function blockedState(project: Project): ReactNode {
  const toProject = (
    <Button asChild variant="outline">
      <Link href={projectHref(project.id)}>Back to the project</Link>
    </Button>
  );
  switch (hireDevsAccess(project)) {
    case "ok":
      return null;
    case "not-lead":
      return (
        <StateCard
          as="h1"
          icon={<LockIcon aria-hidden />}
          title="Only the Team Lead can hire developers"
          message="The Team Lead chooses who joins this team. If you'd like to join, apply from the project page."
          action={toProject}
        />
      );
    case "full":
      return (
        <StateCard
          as="h1"
          icon={<UsersIcon aria-hidden />}
          title="Your team is full"
          message="Every spot is taken. If your team has fewer than 7 people, you can raise its size on the project page."
          action={toProject}
        />
      );
    case "closed":
      return (
        <StateCard
          as="h1"
          icon={<LockIcon aria-hidden />}
          title="Recruitment has closed"
          message="This team is no longer taking new members."
          action={toProject}
        />
      );
  }
}
