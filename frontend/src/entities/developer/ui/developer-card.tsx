import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { portfolioHref } from "../api/developer-api";
import type { DeveloperCard as Developer } from "../model/developer";
import { AvailabilityBadge, SkillList } from "./developer-bits";

const MAX_SKILLS_SHOWN = 6;

/** A directory result. The whole card is one link to the portfolio. */
export function DeveloperCard({ developer }: { developer: Developer }) {
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
          {more > 0 ? <span>+{more} more skills</span> : null}
          <span>{projects === 1 ? "1 project" : `${projects} projects`}</span>
        </div>
      </CardContent>
    </Card>
  );
}
