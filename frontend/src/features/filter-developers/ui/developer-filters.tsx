"use client";

import { ChevronDownIcon, Loader2Icon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import {
  directoryQuery,
  hasFilters,
  NO_FILTERS,
  normalizeSkills,
  PORTFOLIO_LIMITS,
  TIME_ZONE_OPTIONS,
  timeZoneOptionLabel,
  type DirectoryFilters as Filters,
} from "@/entities/developer";
import { SkillsInput } from "@/entities/skill";
import { cn } from "@/shared/lib/utils";
import { FormField } from "@/shared/ui/molecules/form-field";
import { InfoTip } from "@/shared/ui/molecules/info-tip";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

type Props = {
  initial: Filters;
  /** The page the filters belong to; changes are pushed to `basePath?…`. */
  basePath: string;
};

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";
const CHECKBOX_CLASS = "size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Developer filters: search, skills, time zone, new talent and availability
 * (#93). Shared by the directory and Hire Devs (#91); each passes its own
 * `basePath`. Every change goes into the URL, so the address bar always
 * reproduces the view. Skills, time zone and the toggles apply at once; the
 * search text applies on Enter.
 *
 * Time zone and New talent are PLANNED (the API can't filter on them yet):
 * the page narrows its loaded results with `matchesPlannedFilters`, and the
 * note under them says so. On a phone they fold under "More filters".
 */
export function DeveloperFilters({ initial, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ids = useId();
  // Local copies so a click shows at once; the URL (and results) follow.
  const [current, setCurrent] = useState(initial);
  // When the URL changes (a filter applied, back/forward, Clear), show what it says.
  const [shown, setShown] = useState(directoryQuery(initial));
  if (shown !== directoryQuery(initial)) {
    setShown(directoryQuery(initial));
    setCurrent(initial);
  }
  const plannedOn = (current.time_zone ? 1 : 0) + (current.new_talent ? 1 : 0);
  const [moreOpen, setMoreOpen] = useState(plannedOn > 0);

  const go = (next: Filters) =>
    startTransition(() => router.push(`${basePath}${directoryQuery({ ...next, page: 1 })}`, { scroll: false }));
  /** Updates a filter on screen and, unless it's the search text, applies it. */
  const apply = (change: Partial<Filters>) => {
    const next = { ...current, ...change };
    setCurrent(next);
    go(next);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    go(current);
  };

  // On a phone the planned filters fold away; from md up they're always shown.
  const foldable = moreOpen ? "" : "max-md:hidden";
  const moreIds = `${ids}-tz-field ${ids}-new-field ${ids}-note`;

  return (
    <form role="search" aria-label="Filter developers" onSubmit={onSubmit} className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FormField id="directory-q" label="Search" hint="Matches names and headlines." markOptional={false}>
          {(aria) => (
            <div className="flex gap-2">
              <Input
                {...aria}
                type="search"
                value={current.q}
                maxLength={PORTFOLIO_LIMITS.search}
                placeholder="e.g. Ada, or full-stack"
                onChange={(event) => setCurrent({ ...current, q: event.target.value })}
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
              value={current.skills}
              placeholder="e.g. React"
              onChange={(next) => apply({ skills: normalizeSkills(next) })}
            />
          )}
        </FormField>

        <Button
          type="button"
          variant="outline"
          className="justify-between md:hidden"
          aria-expanded={moreOpen}
          aria-controls={moreIds}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontalIcon aria-hidden /> More filters
            {plannedOn ? <Badge>{plannedOn} on</Badge> : null}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn("transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")}
          />
        </Button>

        <div id={`${ids}-tz-field`} className={foldable}>
          <FormField id="directory-tz" label="Time zone" hint="Where the developer works from. Times shown are standard time; daylight saving adds an hour in summer." markOptional={false}>
            {(aria) => (
              <select
                {...aria}
                value={current.time_zone}
                onChange={(event) => apply({ time_zone: event.target.value })}
                className={SELECT_CLASS}
              >
                <option value="">Any time zone</option>
                {TIME_ZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {timeZoneOptionLabel(option)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-2 lg:col-span-3">
          <div id={`${ids}-new-field`} className={cn("flex items-center gap-1", foldable)}>
            <Toggle
              id="directory-new-talent"
              label="New talent only"
              checked={current.new_talent}
              onChange={(checked) => apply({ new_talent: checked })}
            />
            <InfoTip label="Explain the new talent filter">
              Developers who joined NextNode in the past 15 days. Use it to give newcomers a chance on your
              team.
            </InfoTip>
          </div>
          <div className="flex items-center gap-1">
            <Toggle
              id="directory-available"
              label="Available for work only"
              checked={current.available}
              onChange={(checked) => apply({ available: checked })}
            />
            <InfoTip label="Explain the availability filter">
              Developers who&apos;ve marked themselves as available for work on their portfolio, so they&apos;re open
              to joining a project now.
            </InfoTip>
          </div>
          <div className="flex items-center gap-3 md:ml-auto">
            {pending ? (
              <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Updating results…
              </span>
            ) : null}
            {hasFilters(current) ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => apply(NO_FILTERS)}>
                <XIcon aria-hidden /> Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        <p
          id={`${ids}-note`}
          className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:col-span-2 lg:col-span-3", foldable)}
        >
          <PrototypeBadge />
          Time zone and New talent use sample profile values and only filter the page you&apos;re on.
        </p>
      </div>
    </form>
  );
}

function Toggle(props: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="flex min-h-9 items-center gap-2">
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className={CHECKBOX_CLASS}
      />
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
      </label>
    </span>
  );
}
