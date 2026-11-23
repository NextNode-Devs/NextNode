import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { DeveloperMatch } from "@/entities/developer";
import { cn } from "@/shared/lib/utils";
import { InfoTip } from "@/shared/ui/molecules/info-tip";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Badge } from "@/shared/ui/shadcn/badge";

/** How many suggestions the panel shows. */
export const SUGGESTION_LIMIT = 3;

type Props = {
  /** Every developer, already scored and ranked best first, before any filter. */
  ranked: DeveloperMatch[];
  /** How many skills the project lists. */
  requiredCount: number;
  /** The buttons for one suggestion (invite, view): the screen brings its own. */
  actions: (entry: DeveloperMatch) => ReactNode;
};

/**
 * "Suggested for your team" (NN-33, prototype): the few best matches, shown
 * above the full list and unaffected by its filters. Each one says why it was
 * suggested; the Lead still chooses who to invite.
 */
export function SuggestedDevelopers({ ranked, requiredCount, actions }: Props) {
  const suggestions = ranked.filter((entry) => entry.match.matched_skills.length > 0).slice(0, SUGGESTION_LIMIT);
  return (
    <section aria-labelledby="suggested-heading" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="suggested-heading" className="flex items-center gap-1.5 text-lg font-semibold">
          <SparklesIcon className="size-5 text-primary" aria-hidden />
          Suggested for your team
          <InfoTip label="How suggestions work">
            The best matches by one rule: the project&apos;s required skills a developer has, plus one point if
            they&apos;re available now. Suggestions only; you choose who to invite. The filters below don&apos;t change
            them.
          </InfoTip>
        </h2>
        <PrototypeBadge />
      </div>
      {requiredCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your project lists no tech stack yet, so there is nothing to match on. Browse all developers below.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has any of your required skills yet. Browse all developers below, or invite new talent who can learn
          them.
        </p>
      ) : (
        <ol aria-label="Suggested developers" className="divide-y rounded-lg border">
          {suggestions.map((entry, index) => (
            <Suggestion key={entry.developer.account_id} entry={entry} rank={index + 1} actions={actions(entry)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Suggestion({ entry, rank, actions }: { entry: DeveloperMatch; rank: number; actions: ReactNode }) {
  const { developer, match } = entry;
  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground tabular-nums">#{rank}</span>
          <span className="font-medium break-words">{developer.display_name}</span>
          {entry.growth.is_new_talent ? <Badge variant="outline">New talent</Badge> : null}
        </p>
        <p className="text-sm font-medium">
          <span className="sr-only">Why: </span>
          {match.reason}
        </p>
        <p className="text-xs text-muted-foreground">
          Has {match.matched_skills.map((skill) => skill.label).join(", ")}
          {match.missing_skills.length
            ? ` · could learn ${match.missing_skills.map((skill) => skill.label).join(", ")}`
            : " · every required skill"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:w-48 md:items-end">
        <ScoreMeter score={match.score} name={developer.display_name} />
        <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div>
      </div>
    </li>
  );
}

function ScoreMeter({ score, name }: { score: number; name: string }) {
  const tone = score >= 75 ? "bg-success" : score >= 50 ? "bg-primary" : "bg-muted-foreground";
  return (
    <div className="w-full space-y-1">
      <p className="flex justify-between text-xs">
        <span className="text-muted-foreground">Match</span>
        <span className="font-semibold tabular-nums">{score}%</span>
      </p>
      <div
        role="meter"
        aria-label={`${name}'s match score`}
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
