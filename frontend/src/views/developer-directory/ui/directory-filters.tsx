"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  directoryQuery,
  hasFilters,
  NO_FILTERS,
  normalizeSkills,
  PORTFOLIO_LIMITS,
  type DirectoryFilters as Filters,
} from "@/entities/developer";
import { SkillsInput } from "@/entities/skill";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

type Props = { initial: Filters };

/**
 * The directory's filters. Every change goes into the URL, so the address bar
 * always reproduces the view: share it, reload it, or go back. Skills and the
 * availability toggle apply at once; the search text applies on Enter.
 */
export function DirectoryFilters({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Local copies so a click shows at once; the URL (and results) follow.
  const [q, setQ] = useState(initial.q);
  const [skills, setSkills] = useState(initial.skills);
  const [available, setAvailable] = useState(initial.available);
  // When the URL changes (a filter applied, back/forward, Clear), show what it says.
  const [shown, setShown] = useState(directoryQuery(initial));
  if (shown !== directoryQuery(initial)) {
    setShown(directoryQuery(initial));
    setQ(initial.q);
    setSkills(initial.skills);
    setAvailable(initial.available);
  }

  const go = (next: Filters) =>
    startTransition(() => router.push(`/developers${directoryQuery({ ...next, page: 1 })}`, { scroll: false }));
  const current = { ...initial, q, skills, available };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    go(current);
  };

  return (
    <form role="search" aria-label="Filter developers" onSubmit={onSubmit} className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="directory-q" label="Search" hint="Matches names and headlines." markOptional={false}>
          {(aria) => (
            <div className="flex gap-2">
              <Input
                {...aria}
                type="search"
                value={q}
                maxLength={PORTFOLIO_LIMITS.search}
                placeholder="e.g. Ada, or full-stack"
                onChange={(event) => setQ(event.target.value)}
              />
              <Button type="submit" variant="outline">
                <SearchIcon aria-hidden /> Search
              </Button>
            </div>
          )}
        </FormField>
        <FormField
          id="directory-skills"
          label="Skills"
          hint="Shows developers with every skill you add."
          markOptional={false}
        >
          {(aria) => (
            <SkillsInput
              {...aria}
              value={skills}
              placeholder="e.g. React"
              onChange={(next) => {
                setSkills(normalizeSkills(next));
                go({ ...current, skills: normalizeSkills(next) });
              }}
            />
          )}
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            id="directory-available"
            type="checkbox"
            checked={available}
            onChange={(event) => {
              setAvailable(event.target.checked);
              go({ ...current, available: event.target.checked });
            }}
            className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <label htmlFor="directory-available" className="text-sm font-medium">
            Available for work only
          </label>
        </div>
        <div className="flex items-center gap-3">
          {pending ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Updating results…
            </span>
          ) : null}
          {hasFilters({ ...initial, skills, available }) ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => go(NO_FILTERS)}>
              <XIcon aria-hidden /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
