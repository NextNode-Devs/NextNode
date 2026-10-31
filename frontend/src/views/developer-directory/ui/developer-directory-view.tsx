import { redirect } from "next/navigation";
import { Suspense } from "react";

import { directoryQuery, parseDirectoryParams, searchDevelopers, type DirectoryFilters as Filters } from "@/entities/developer";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { AppHeader } from "@/widgets/app-header";

import { DirectoryFilters } from "./directory-filters";
import { DirectoryResults } from "./directory-results";

type SearchParams = Record<string, string | string[] | undefined>;

/** `/developers`: find developers by name, headline, skills and availability. */
export function DeveloperDirectoryView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <AppHeader current="developers" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Developers</h1>
          <p className="text-muted-foreground">
            Find developers by name, headline or skills, and open their portfolios.
          </p>
        </header>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <Directory searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Directory({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseDirectoryParams(await searchParams);
  const query = directoryQuery(filters);
  return (
    <>
      <DirectoryFilters initial={filters} />
      <Suspense key={query} fallback={<LoadingCards count={6} label="Loading developers" />}>
        <Results filters={filters} path={`/developers${query}`} />
      </Suspense>
    </>
  );
}

async function Results({ filters, path }: { filters: Filters; path: string }) {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load developers" message={route.message} />;

  const result = await searchDevelopers(authedServerApi, filters);
  if (!result.ok) return <LoadError title="We couldn't load developers" message={result.error.message} />;
  return <DirectoryResults filters={filters} page={result.data} />;
}
