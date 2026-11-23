import { Clock3Icon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { portfolioHref } from "../api/developer-api";
import type { DeveloperCard as Developer } from "../model/developer";
import { timeZoneWithCode, type ProfileGrowth } from "../model/profile-growth";
import { AvailabilityBadge, SkillList } from "./developer-bits";
import { NewTalentBadge } from "./new-talent-badge";

const MAX_SKILLS_SHOWN = 6;

type Props = {
  developer: Developer;
  /** Planned profile fields (#102), shown when given: the time zone. */
  growth?: ProfileGrowth;
};

/** A directory result. The whole card is one link to the portfolio. */
export function DeveloperCard({ developer, growth }: Props) {
  const shown = developer.skills.slice(0, MAX_SKILLS_SHOWN);
  const more = developer.skills.length - shown.length;
  const projects = developer.project_count;
  return (
    <Card className="relative h-full gap-3 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40">
      <CardHeader className="gap-1">
        <CardTitle className="text-base">
          <h2>
            <Link
              href={portfolioHref(developer.account_id)}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {developer.display_name}
            </Link>
          </h2>
        </CardTitle>
        <CardDescription className="line-clamp-2">{developer.headline}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <SkillList skills={shown} label={`${developer.display_name}'s skills`} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <AvailabilityBadge available={developer.is_available} />
          {/* Real: the account was created in the past 15 days (rule of 21 Nov 2026). */}
          {developer.is_new_talent ? <NewTalentBadge /> : null}
          {growth ? (
            <span className="inline-flex items-center gap-1">
              <Clock3Icon className="size-3" aria-hidden />
              {growth.time_zone ? timeZoneWithCode(growth.time_zone) : "Time zone not set"}
            </span>
          ) : null}
          {more > 0 ? <span>+{more} more skills</span> : null}
          <span>{projects === 1 ? "1 project" : `${projects} projects`}</span>
        </div>
      </CardContent>
    </Card>
  );
}
