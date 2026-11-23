import { SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { DeveloperMatchCard, hasFilters, type DeveloperMatch, type DirectoryFilters } from "@/entities/developer";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";

import { MatchActions } from "./match-actions";

type Props = {
  matches: DeveloperMatch[];
  filters: DirectoryFilters;
  /** The screen's own path, where Clear filters goes. */
  basePath: string;
  /** How many skills the project lists; none means the score is availability only. */
  requiredCount: number;
};

/** Ranked developer cards, best match first, with the empty states. */
export function HireDevsResults({ matches, filters, basePath, requiredCount }: Props) {
  if (matches.length === 0) {
    return hasFilters(filters) ? (
      <StateCard
        icon={<SearchXIcon aria-hidden />}
        title="No developers match these filters"
        message="Try fewer skills, a shorter search, any time zone, or include developers who aren't marked available."
        action={
          <Button asChild variant="outline">
            <Link href={basePath}>Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <StateCard
        icon={<UsersIcon aria-hidden />}
        title="No developers to suggest yet"
        message="Developers appear here once they set up a portfolio."
      />
    );
  }

  return (
    <section aria-labelledby="hire-devs-results" className="space-y-4">
      <div className="space-y-1">
        <h2 id="hire-devs-results" className="text-lg font-semibold">
          Developers
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {matches.length === 1 ? "1 developer" : `${matches.length} developers`}
          {hasFilters(filters) ? " matching your filters" : ""}, best match first.{" "}
          {requiredCount === 0
            ? "Your project lists no tech stack, so the score is availability only."
            : "The score counts your project's required skills each developer has, plus whether they're available now."}
        </p>
      </div>
      <ul aria-label="Developers, best match first" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((entry) => (
          <li key={entry.developer.account_id}>
            <DeveloperMatchCard {...entry} actions={<MatchActions name={entry.developer.display_name} />} />
          </li>
        ))}
      </ul>
    </section>
  );
}
