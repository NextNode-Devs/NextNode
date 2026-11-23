"use client";

import { useId, useState } from "react";

import { PROJECT_ROLE_LABEL, type AttentionItem, type DashboardProject } from "@/entities/project";
import type { ProjectUpdate } from "@/entities/project-update";
import { cn } from "@/shared/lib/utils";

import { byRole, roleOptions, type RoleFilter } from "../model/overview";
import { AttentionList } from "./attention-list";
import { ProjectRows } from "./project-rows";

type Props = {
  projects: DashboardProject[];
  attention: AttentionItem[];
  updates: readonly ProjectUpdate[];
};

/**
 * The role filter, and the two lists it narrows: needs attention and projects.
 * Shown only when the viewer holds more than one role; a client is always Client.
 */
export function RoleOverview({ projects, attention, updates }: Props) {
  const id = useId();
  const [filter, setFilter] = useState<RoleFilter>("all");
  const options = roleOptions(projects);
  const choices: { value: RoleFilter; label: string; count: number }[] = [
    { value: "all", label: "All roles", count: projects.length },
    ...options.map(({ role, count }) => ({ value: role, label: PROJECT_ROLE_LABEL[role], count })),
  ];

  return (
    <div className="space-y-6">
      {options.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Show projects where I&apos;m</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => (
              <label
                key={choice.value}
                htmlFor={`${id}-${choice.value}`}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-accent/50",
                  filter === choice.value && "border-foreground bg-accent font-medium",
                )}
              >
                <input
                  id={`${id}-${choice.value}`}
                  type="radio"
                  name={`${id}-role`}
                  value={choice.value}
                  checked={filter === choice.value}
                  onChange={() => setFilter(choice.value)}
                  className="sr-only"
                />
                {choice.label}
                <span className="text-xs text-muted-foreground tabular-nums" aria-hidden>
                  ({choice.count})
                </span>
                <span className="sr-only">
                  , {choice.count === 1 ? "1 project" : `${choice.count} projects`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <section aria-labelledby={`${id}-attention`} className="space-y-2">
        <h4 id={`${id}-attention`} className="font-medium">
          Needs attention
        </h4>
        <AttentionList items={byRole(attention, filter)} />
      </section>

      <section aria-labelledby={`${id}-projects`} className="space-y-2">
        <h4 id={`${id}-projects`} className="font-medium">
          Projects and your role
        </h4>
        <ProjectRows projects={byRole(projects, filter)} updates={updates} filter={filter} />
      </section>
    </div>
  );
}
