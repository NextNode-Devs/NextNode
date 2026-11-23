import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import {
  AvailabilityBadge,
  portfolioHref,
  type DeveloperCardData,
  type DeveloperMatch,
} from "@/entities/developer";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";

type Suggestion = { developer: DeveloperCardData; match: DeveloperMatch };

/** The suggested developers, best match first. Every row says why it was suggested. */
export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <ol aria-label="Suggested developers" className="divide-y rounded-lg border">
      {suggestions.map(({ developer, match }, index) => (
        <li key={developer.account_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-muted-foreground tabular-nums">#{index + 1}</span>
              <Link
                href={portfolioHref(developer.account_id)}
                className="font-medium break-words underline-offset-4 hover:underline"
              >
                {developer.display_name}
              </Link>
              {developer.is_new_talent ? (
                <Badge variant="outline" className="gap-1">
                  <SparklesIcon aria-hidden /> New talent
                </Badge>
              ) : null}
              <AvailabilityBadge available={developer.is_available} />
            </div>
            {developer.headline ? <p className="text-sm text-muted-foreground">{developer.headline}</p> : null}
            <MatchReason match={match} />
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <ScoreMeter score={match.score} />
            <Button asChild size="sm" variant="outline">
              <Link href={portfolioHref(developer.account_id)} aria-label={`Open ${developer.display_name}'s portfolio to invite them`}>
                Portfolio and invite <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MatchReason({ match }: { match: DeveloperMatch }) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="font-medium">{match.reason}</p>
      <ul aria-label="Required skills they have" className="flex flex-wrap gap-1.5">
        {match.matched.map((skill) => (
          <li key={skill.key}>
            <Badge variant="secondary">{skill.label}</Badge>
          </li>
        ))}
      </ul>
      {match.missing.length ? (
        <p className="text-xs text-muted-foreground">Missing: {match.missing.map((skill) => skill.label).join(", ")}</p>
      ) : null}
    </div>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-success" : score >= 50 ? "bg-primary" : "bg-muted-foreground";
  return (
    <div className="w-full space-y-1 sm:w-32">
      <p className="flex justify-between text-xs sm:justify-end sm:gap-1">
        <span className="text-muted-foreground">Match</span>
        <span className="font-semibold tabular-nums">{score}%</span>
      </p>
      <div
        role="meter"
        aria-label="Match score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
