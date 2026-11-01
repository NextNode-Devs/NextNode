import type { ReactNode } from "react";

import type { Portfolio } from "@/entities/developer";
import type { Role } from "@/entities/viewer";
import { InviteToTeam } from "@/features/invite-developer";
import { InviteToLead } from "@/features/invite-to-lead";

type Props = {
  portfolio: Portfolio;
  viewerRole: Role;
};

/**
 * What a viewer in this role may start from someone else's portfolio:
 * - #4 (Hire Lead): "Invite to lead…" for `client`, shown only when they have a
 *   posted project that still needs a Team Lead (the feature checks).
 * - #5 (Hire Devs): "Invite to my team…" for `developer`, shown only to Team
 *   Leads with open spots (Team Lead is per project, never a role; the feature checks).
 * They are separate actions with separate labels.
 */
export function actionsFor(portfolio: Portfolio, viewerRole: Role): ReactNode[] {
  const actions: Record<Role, ReactNode[]> = {
    client: [
      <InviteToLead
        key="invite-to-lead"
        developerId={portfolio.account_id}
        developerName={portfolio.display_name}
      />,
    ],
    developer: [
      <InviteToTeam
        key="invite-to-team"
        developerId={portfolio.account_id}
        developerName={portfolio.display_name}
      />,
    ],
  };
  return actions[viewerRole];
}

/** The action area on a portfolio (#2's integration contract for #4 and #5).
 * Never shown to the portfolio's owner, whatever the actions are. */
export function PortfolioActions({ portfolio, viewerRole }: Props) {
  if (portfolio.is_owner) return null;
  const actions = actionsFor(portfolio, viewerRole);
  return actions.length ? <>{actions}</> : null;
}
