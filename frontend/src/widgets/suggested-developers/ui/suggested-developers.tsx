import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { NO_FILTERS, searchDevelopers, suggestDevelopers } from "@/entities/developer";
import type { Project } from "@/entities/project";
import type { TeamProfile } from "@/entities/team";
import { authedServerApi } from "@/shared/api/server-client";
import { InfoTip } from "@/shared/ui/molecules/info-tip";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";

import { SuggestionList } from "./suggestion-list";

type Props = { project: Project; team: TeamProfile; myAccountId: number };

/**
 * Suggested developers for a team with open spots (NN-33, prototype). Scored
 * by the rule in `entities/developer/model/match.ts` against the first page of
 * the live directory; the planned API scores every developer on the server.
 * Suggestions only: the Lead opens a portfolio and invites from there (#5).
 */
export async function SuggestedDevelopers({ project, team, myAccountId }: Props) {
  return (
    <section aria-labelledby="suggested-heading" className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="suggested-heading" className="flex items-center gap-1.5 text-base font-semibold">
          Suggested developers
          <InfoTip label="How suggestions work">
            The score counts the project&apos;s required skills a developer has, plus one point if they&apos;re
            available, out of the required skills plus one. You always choose who to invite.
          </InfoTip>
        </h2>
        <PrototypeBadge />
      </div>
      <Body project={project} team={team} myAccountId={myAccountId} />
    </section>
  );
}

async function Body({ project, team, myAccountId }: Props) {
  if (project.tech_stack.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This project lists no required skills yet, so there is nothing to match on. The project&apos;s owner can add them by editing it.
      </p>
    );
  }
  const result = await searchDevelopers(authedServerApi, NO_FILTERS);
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We couldn&apos;t load developers to suggest. {result.error.message} Try again in a moment.
      </p>
    );
  }
  const onTeam = [myAccountId, ...team.members.map((member) => member.account_id)];
  const suggestions = suggestDevelopers(project.tech_stack, result.data.results, onTeam);
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <SearchXIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          No developer has any of this project&apos;s required skills yet. Try the full directory.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/developers">Browse all developers</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Required skills: {project.tech_stack.map((skill) => skill.label).join(", ")}. Best match first.
      </p>
      <SuggestionList suggestions={suggestions} />
    </>
  );
}
