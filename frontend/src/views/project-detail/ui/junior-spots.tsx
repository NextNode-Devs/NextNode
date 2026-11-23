import { SearchIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { NewTalentBadge } from "@/entities/developer";
import type { Project } from "@/entities/project";
import {
  juniorCount,
  juniorSpotsLine,
  NEW_TALENT_DIRECTORY_HREF,
  newTalentHireDevsHref,
  spotsWithJunior,
  sampleJuniorCount,
} from "@/entities/team";
import { MarkJuniorSpots } from "@/features/mark-junior-spots";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * Phase 2 prototype (NN-36 #99): junior spots, beside the Phase 1 team roster.
 * The open spots are the team's real ones; which are junior is sample data.
 * The Team Lead marks them and finds new talent (NN-33 Hire Devs, NN-34
 * directory); everyone else sees how many spots are junior.
 */
export function JuniorSpots({ project }: { project: Project }) {
  const { team, viewer } = project;
  if (team.status !== "open") return null;
  const lead = viewer.is_lead;

  if (team.size === null || team.open_spots <= 0) {
    if (!lead || team.size !== null) return null;
    return (
      <SpotsCard description="Set the team size first. Junior spots are chosen from the open spots.">
        <p className="text-muted-foreground">Teams have 5 to 7 people, Team Lead included.</p>
      </SpotsCard>
    );
  }

  const spots = spotsWithJunior(team.open_spots, sampleJuniorCount(team.open_spots));
  if (lead) {
    return (
      <SpotsCard description="Keep some open spots for developers new to NextNode. Sample values: the API doesn't store spot types yet.">
        <MarkJuniorSpots initial={spots} />
        <div className="flex flex-col gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={newTalentHireDevsHref(project.id)}>
              <SparklesIcon aria-hidden data-icon="inline-start" />
              Matched new talent
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={NEW_TALENT_DIRECTORY_HREF}>
              <SearchIcon aria-hidden data-icon="inline-start" />
              Browse new talent
            </Link>
          </Button>
        </div>
      </SpotsCard>
    );
  }

  if (juniorCount(spots) === 0) return null;
  return (
    <SpotsCard description="Sample values: the API doesn't store spot types yet.">
      <p>{juniorSpotsLine(spots)}</p>
      <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <NewTalentBadge />
        <span>Joined NextNode in the last 15 days? These spots are for you.</span>
      </p>
    </SpotsCard>
  );
}

function SpotsCard({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Junior spots</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}
