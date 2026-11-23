import { Clock3Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import type { DeveloperMatch } from "../model/match";
import { timeZoneWithCode } from "../model/profile-growth";
import { AvailabilityBadge, SkillList } from "./developer-bits";
import { NewTalentBadge } from "./new-talent-badge";

type Props = DeveloperMatch & {
  /** The buttons under the card (invite, view): each screen brings its own. */
  actions?: ReactNode;
};

/**
 * A Hire Devs result (#91): who the developer is, the rule-based match score
 * and, always, the reason for it. The required skills they have are listed
 * first; the ones they lack are named, so nobody reads the score as a verdict.
 */
export function DeveloperMatchCard({ developer, growth, match, actions }: Props) {
  const name = developer.display_name;
  const projects = developer.project_count;
  return (
    <Card className="h-full gap-3">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 text-base">
            <h3 className="break-words">{name}</h3>
          </CardTitle>
          <Badge variant={match.score >= 75 ? "default" : "secondary"} className="shrink-0 tabular-nums">
            {match.score}% match
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{developer.headline}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3 text-sm">
        <p className="font-medium">
          <span className="sr-only">Why: </span>
          {match.reason}
        </p>
        {match.matched_skills.length ? (
          <SkillList skills={match.matched_skills} label={`Required skills ${name} has`} />
        ) : null}
        {match.missing_skills.length ? (
          <p className="text-xs text-muted-foreground">
            Doesn&apos;t list: {match.missing_skills.map((skill) => skill.label).join(", ")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <AvailabilityBadge available={developer.is_available} />
          {developer.is_new_talent ? <NewTalentBadge /> : null}
          <span className="inline-flex items-center gap-1">
            <Clock3Icon className="size-3" aria-hidden />
            {growth.time_zone ? timeZoneWithCode(growth.time_zone) : "Time zone not set"}
          </span>
          <span>{projects === 1 ? "1 project" : `${projects} projects`}</span>
        </div>
      </CardContent>
      {actions ? <CardFooter className="flex flex-wrap gap-2">{actions}</CardFooter> : null}
    </Card>
  );
}
