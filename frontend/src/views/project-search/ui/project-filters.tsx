"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  hasProjectFilters,
  NO_PROJECT_FILTERS,
  normalizeTech,
  projectQuery,
  type ProjectFilters as Filters,
  type ProjectKind,
} from "@/entities/project";
import { SkillsInput } from "@/entities/skill";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Button } from "@/shared/ui/shadcn/button";

const KINDS: { value: ProjectKind | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "client", label: "Client projects" },
  { value: "developer", label: "Developer ideas" },
];

/**
 * The search's filters. Every change goes into the URL at once, so the address
 * bar always reproduces the view: share it, reload it, or go back.
 */
export function ProjectFilters({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(initial);
  // When the URL changes (back/forward, Clear), show what it says.
  const [shown, setShown] = useState(projectQuery(initial));
  if (shown !== projectQuery(initial)) {
    setShown(projectQuery(initial));
    setCurrent(initial);
  }

  const go = (next: Filters) => {
    setCurrent(next);
    startTransition(() => router.push(`/projects${projectQuery({ ...next, page: 1 })}`, { scroll: false }));
  };

  return (
    <form
      role="search"
      aria-label="Filter projects"
      onSubmit={(event) => event.preventDefault()}
      className="space-y-4 rounded-xl border p-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Kind</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((kind) => (
              <Button
                key={kind.label}
                type="button"
                size="sm"
                variant={current.kind === kind.value ? "default" : "outline"}
                aria-pressed={current.kind === kind.value}
                onClick={() => go({ ...current, kind: kind.value })}
              >
                {kind.label}
              </Button>
            ))}
          </div>
        </fieldset>
        <FormField
          id="project-tech"
          label="Tech stack"
          hint="Shows projects using every technology you add."
          markOptional={false}
        >
          {(aria) => (
            <SkillsInput
              {...aria}
              value={current.tech}
              placeholder="e.g. React"
              onChange={(next) => go({ ...current, tech: normalizeTech(next) })}
            />
          )}
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Toggle
            id="needs-lead"
            label="Needs a Team Lead"
            checked={current.needsLead}
            onChange={(checked) => go({ ...current, needsLead: checked })}
          />
          <Toggle
            id="open-spots"
            label="Has open developer spots"
            checked={current.openSpots}
            onChange={(checked) => go({ ...current, openSpots: checked })}
          />
        </div>
        <div className="flex items-center gap-3">
          {pending ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Updating results…
            </span>
          ) : null}
          {hasProjectFilters(current) ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => go(NO_PROJECT_FILTERS)}>
              <XIcon aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Toggle(props: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
      </label>
    </div>
  );
}
