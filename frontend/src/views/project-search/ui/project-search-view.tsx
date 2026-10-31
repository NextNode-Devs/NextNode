import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { parseProjectParams, projectQuery, searchProjects, type ProjectFilters as Filters } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { AppHeader } from "@/widgets/app-header";

import { ProjectFilters } from "./project-filters";
import { ProjectResults } from "./project-results";

type SearchParams = Record<string, string | string[] | undefined>;

/** `/projects`: find projects to lead or join. */
export function ProjectSearchView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
            <p className="text-muted-foreground">
              Client projects looking for a Team Lead, and developer ideas looking for a team.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <PlusIcon aria-hidden /> New project
            </Link>
          </Button>
        </header>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <Search searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Search({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseProjectParams(await searchParams);
  const query = projectQuery(filters);
  return (
    <>
      <ProjectFilters initial={filters} />
      <Suspense key={query} fallback={<LoadingCards count={6} label="Loading projects" />}>
        <Results filters={filters} path={`/projects${query}`} />
      </Suspense>
    </>
  );
}

async function Results({ filters, path }: { filters: Filters; path: string }) {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load projects" message={route.message} />;

  const result = await searchProjects(authedServerApi, filters);
  if (!result.ok) return <LoadError title="We couldn't load projects" message={result.error.message} />;
  return <ProjectResults filters={filters} page={result.data} />;
}
