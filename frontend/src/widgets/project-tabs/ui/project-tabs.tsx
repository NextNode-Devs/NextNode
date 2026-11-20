import Link from "next/link";

import type { Project } from "@/entities/project";
import { cn } from "@/shared/lib/utils";

import { projectTabs, type ProjectTab } from "../model/tabs";

type Props = { project: Project; current: ProjectTab };

/**
 * The project page's sections (#92): one link per tab, the current one marked
 * in words and style. Renders nothing for someone outside the project.
 */
export function ProjectTabs({ project, current }: Props) {
  const tabs = projectTabs(project);
  if (tabs.length === 0) return null;

  return (
    <nav aria-label="Project sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {tabs.map(({ tab, label, href }) => {
          const active = tab === current;
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  // Inset: the bar scrolls sideways, which clips anything drawn outside the link.
                  "rounded-t-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
