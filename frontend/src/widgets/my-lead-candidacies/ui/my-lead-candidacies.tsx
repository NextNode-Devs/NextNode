import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import {
  getMyLeadCandidacies,
  LEAD_STATUS_TAG,
  leadChatHref,
  type MyLeadCandidacy,
} from "@/entities/lead-candidacy";
import type { Role } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { Badge } from "@/shared/ui/shadcn/badge";

import { pickFor, type Show } from "../model/pick";

type Props = {
  role: Role;
  /** A developer's dashboard splits invitations from applications; a client's shows both. */
  show: Show;
  limit?: number;
};

const EMPTY: Record<Show, string> = {
  all: "No one has applied yet. Developers who apply to lead your projects, or that you invite from their portfolio, will appear here.",
  invitation: "No invitations yet. When a client invites you to lead their project, it will appear here.",
  application: "You haven't applied to lead a project yet. Projects you apply to lead will appear here.",
};

/**
 * The dashboard's Hire Lead lists (#4): a client's applicants and invitees, a
 * developer's invitations or applications. Each opens the conversation on the
 * project's page. Team applications and invitations are `widgets/team-candidacies` (#5).
 */
export async function MyLeadCandidacies({ role, show, limit = 5 }: Props) {
  const result = await getMyLeadCandidacies(authedServerApi);
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
        {show === "application" ? (
          <Link href="/projects?needs_lead=true" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
            Find a project to lead <ArrowRightIcon className="size-4" aria-hidden />
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
            href={leadChatHref(item.project_id, item.candidacy_id)}
            className="flex items-center justify-between gap-3 p-3 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {role === "client" ? item.developer_name : item.project_title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{subtitle(item, role)}</span>
            </span>
            <Badge variant={needsYou(item, role) ? "default" : "secondary"}>{LEAD_STATUS_TAG[item.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function subtitle(item: MyLeadCandidacy, role: Role): string {
  if (role === "client") {
    return `${item.kind === "application" ? "Applied to lead" : "You invited them to lead"} ${item.project_title}`;
  }
  return item.kind === "invitation" ? `Invited by ${item.client_name}` : `Client: ${item.client_name}`;
}

/** Highlighted when the viewer is the one to act: a developer's open invitation, a client's candidate. */
function needsYou(item: MyLeadCandidacy, role: Role): boolean {
  return role === "developer" ? item.status === "invited" : item.status === "candidate";
}
