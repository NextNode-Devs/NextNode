import { CrownIcon, UserIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import type { TeamProfile } from "@/entities/team";
import { SetTeamSize } from "@/features/set-team-size";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  project: Project;
  team: TeamProfile | null;
  loadError: string | null;
};

const spots = (count: number) => `${count} open ${count === 1 ? "spot" : "spots"}`;

function spotsLine(team: TeamProfile): string {
  const people = team.members.length;
  if (team.size === null) {
    return `${people} ${people === 1 ? "person" : "people"} so far. Teams have 5 to 7 people, Team Lead included.`;
  }
  if (team.status !== "open") return `${people} of ${team.size} people. Recruitment has closed.`;
  if (team.open_spots === 0) return `${people} of ${team.size} people. The team is full.`;
  return `${people} of ${team.size} people · ${spots(team.open_spots)}`;
}

/**
 * The team profile (FR2): the Team Lead first, then the members, each linking to
 * their portfolio, with the open spots. The Team Lead also sets the size here.
 */
export function TeamRosterCard({ project, team, loadError }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Team</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {team ? (
          <Roster project={project} team={team} />
        ) : (
          <p role="alert" className="text-destructive">
            We couldn&apos;t load this team. {loadError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Roster({ project, team }: { project: Project; team: TeamProfile }) {
  const me = project.viewer;
  const hasLead = team.members.some((member) => member.role === "lead");
  const recruiting = team.status === "open";
  return (
    <>
      {hasLead ? null : (
        <p className="flex items-start gap-2">
          <CrownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Looking for a Team Lead.</span>{" "}
            <span className="text-muted-foreground">The client hires one from the developers who apply.</span>
          </span>
        </p>
      )}
      {team.members.length > 0 ? (
        <ul aria-label="Team members" className="space-y-2">
          {team.members.map((member) => {
            const lead = member.role === "lead";
            const Icon = lead ? CrownIcon : UserIcon;
            return (
              <li key={member.account_id} className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <Link href={member.portfolio_url} className="font-medium break-words underline-offset-4 hover:underline">
                    {member.display_name}
                  </Link>
                  {lead ? (
                    <Badge variant="secondary" className="ml-2">
                      Team Lead
                    </Badge>
                  ) : null}
                  {member.joined_at ? (
                    <span className="block text-xs text-muted-foreground">Joined {formatMessageTime(member.joined_at)}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="flex items-start gap-2">
        <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{spotsLine(team)}</span>
      </p>
      {me.is_lead && recruiting ? (
        <>
          <SetTeamSize projectId={project.id} size={team.size} headcount={team.members.length} />
          {team.open_spots > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/developers">Find developers to invite</Link>
            </Button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
