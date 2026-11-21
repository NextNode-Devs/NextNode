import { ChevronLeftIcon, ChevronRightIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import {
  DeveloperCard,
  directoryQuery,
  hasFilters,
  hasPlannedFilters,
  matchesPlannedFilters,
  sampleProfileGrowth,
  type DirectoryFilters,
  type DirectoryPage,
} from "@/entities/developer";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";

const href = (filters: DirectoryFilters) => `/developers${directoryQuery(filters)}`;

/** One page of results, with the empty states and the way between pages. */
export function DirectoryResults({ filters, page }: { filters: DirectoryFilters; page: DirectoryPage }) {
  const filtered = hasFilters(filters);
  if (page.total === 0) {
    return filtered ? (
      <StateCard
        icon={<SearchXIcon aria-hidden />}
        title="No developers match these filters"
        message="Try fewer skills, a shorter search, or include developers who aren't marked available."
        action={
          <Button asChild variant="outline">
            <Link href="/developers">Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <StateCard
        icon={<UsersIcon aria-hidden />}
        title="No developers yet"
        message="Developers appear here as soon as they set up their account."
      />
    );
  }

  if (page.results.length === 0) {
    return (
      <StateCard
        icon={<SearchXIcon aria-hidden />}
        title={`There's no page ${page.page}`}
        message={`These filters have ${page.total_pages === 1 ? "one page" : `${page.total_pages} pages`} of results.`}
        action={
          <Button asChild variant="outline">
            <Link href={href({ ...filters, page: 1 })}>Go to the first page</Link>
          </Button>
        }
      />
    );
  }

  const from = (page.page - 1) * page.page_size + 1;
  const to = from + page.results.length - 1;
  // PROTOTYPE (#93): the time zone comes from sample profile values (#102). New
  // talent is real (the API's `is_new_talent`), but both filters still narrow
  // this page only, until the API can filter on them.
  const planned = hasPlannedFilters(filters);
  // The total counts only what the API filtered on (search, skills, availability).
  const apiFiltered = hasFilters({ ...filters, time_zone: "", new_talent: false });
  const shown = page.results
    .map((developer) => ({
      developer,
      growth: { ...sampleProfileGrowth(developer.account_id), is_new_talent: developer.is_new_talent },
    }))
    .filter(({ growth }) => matchesPlannedFilters(growth, filters));
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-muted-foreground">
        {page.total === 1 ? "1 developer" : `Showing ${from}–${to} of ${page.total} developers`}
        {apiFiltered ? " matching your filters" : ""}
        {planned ? `. ${shown.length} on this page match the time zone and new talent filters.` : ""}
      </p>
      {shown.length ? (
        <ul aria-label="Developers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ developer, growth }) => (
            <li key={developer.account_id}>
              <DeveloperCard developer={developer} growth={growth} />
            </li>
          ))}
        </ul>
      ) : (
        <StateCard
          icon={<SearchXIcon aria-hidden />}
          title="No developers on this page match"
          message="Time zone and New talent only filter the page you're on for now. Try another page, or clear those two filters."
          action={
            <Button asChild variant="outline">
              <Link href={href({ ...filters, time_zone: "", new_talent: false })}>Clear time zone and new talent</Link>
            </Button>
          }
        />
      )}
      {page.total_pages > 1 ? <Pagination filters={filters} page={page} /> : null}
    </div>
  );
}

function Pagination({ filters, page }: { filters: DirectoryFilters; page: DirectoryPage }) {
  const previous = page.page > 1 ? href({ ...filters, page: page.page - 1 }) : null;
  const next = page.page < page.total_pages ? href({ ...filters, page: page.page + 1 }) : null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2 pt-2">
      <PageLink href={previous} label="Previous page">
        <ChevronLeftIcon aria-hidden /> Previous
      </PageLink>
      <p className="text-sm text-muted-foreground">
        Page {page.page} of {page.total_pages}
      </p>
      <PageLink href={next} label="Next page">
        Next <ChevronRightIcon aria-hidden />
      </PageLink>
    </nav>
  );
}

/** A real link, or a visibly and actually disabled button at either end. */
function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="outline" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}
