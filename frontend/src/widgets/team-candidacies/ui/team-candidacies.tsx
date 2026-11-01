import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import {
  CANDIDACY_STATUS_TAG,
  candidacyHref,
  getMyTeamCandidacies,
  type MyTeamCandidacy,
} from "@/entities/team";
import { authedServerApi } from "@/shared/api/server-client";
import { Badge } from "@/shared/ui/shadcn/badge";

import { pickFor, type Show } from "../model/pick";

type Props = { show: Show; limit?: number };

const EMPTY: Record<Show, string> = {
  invitations: "No invitations to join a team yet. When a Team Lead invites you, it will appear here.",
  applications: "No applications to join a team yet. Yours, and the ones for the teams you lead, will appear here.",
};

/** The dashboard's Hire Devs lists (#5). Each opens the conversation, where the decision happens. */
export async function TeamCandidacies({ show, limit = 5 }: Props) {
  const result = await getMyTeamCandidacies(authedServerApi);
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We couldn&apos;t load these. {result.error.message}
      </p>
    );
  }
  const items = pickFor(result.data, show);
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{EMPTY[show]}</p>
        {show === "applications" ? (
          <Link
            href="/projects?open_spots=true"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Find a team to join <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {items.slice(0, limit).map((item) => (
        <li key={item.candidacy_id}>
          <Link
            href={candidacyHref(item)}
            className="flex items-center justify-between gap-3 p-3 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{title(item)}</span>
              <span className="block truncate text-xs text-muted-foreground">{subtitle(item)}</span>
            </span>
            <Badge variant={item.actions.accept ? "default" : "secondary"}>{CANDIDACY_STATUS_TAG[item.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function title(item: MyTeamCandidacy): string {
  return item.my_part === "lead" ? item.developer_name : item.project_title;
}

function subtitle(item: MyTeamCandidacy): string {
  if (item.my_part === "lead") {
    return `${item.kind === "application" ? "Applied to join" : "You invited them to"} ${item.project_title}`;
  }
  return item.kind === "invitation" ? `Invited by ${item.lead_name}` : `Team Lead: ${item.lead_name}`;
}
