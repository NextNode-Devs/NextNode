import { ChevronLeftIcon, ChevronRightIcon, FolderOpenIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { hasProjectFilters, ProjectCard, projectQuery, type ProjectFilters, type ProjectPage } from "@/entities/project";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";

const href = (filters: ProjectFilters) => `/projects${projectQuery(filters)}`;

/** One page of results, with the empty states and the way between pages. */
export function ProjectResults({ filters, page }: { filters: ProjectFilters; page: ProjectPage }) {
  const filtered = hasProjectFilters(filters);
  if (page.total === 0) {
    return filtered ? (
      <StateCard
        icon={<SearchXIcon aria-hidden />}
        title="No projects match these filters"
        message="Try fewer technologies, another kind, or turn off a filter."
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <StateCard
        icon={<FolderOpenIcon aria-hidden />}
        title="No projects yet"
        message="Client briefs and developer ideas appear here as soon as they're published."
        action={
          <Button asChild>
            <Link href="/projects/new">Publish the first one</Link>
          </Button>
        }
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
  const previous = page.page > 1 ? href({ ...filters, page: page.page - 1 }) : null;
  const next = page.page < page.total_pages ? href({ ...filters, page: page.page + 1 }) : null;
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-muted-foreground">
        {page.total === 1 ? "1 project" : `Showing ${from}–${to} of ${page.total} projects`}
        {filtered ? " matching your filters" : ""}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {page.results.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
      {page.total_pages > 1 ? (
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
      ) : null}
    </div>
  );
}

/** A real link, or a visibly and actually disabled button at either end. */
function PageLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
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
