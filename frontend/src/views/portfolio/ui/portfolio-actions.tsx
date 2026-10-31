import type { ReactNode } from "react";

import type { Portfolio } from "@/entities/developer";
import type { Role } from "@/entities/viewer";

type Props = {
  portfolio: Portfolio;
  viewerRole: Role;
};

/**
 * What a viewer in this role may start from someone else's portfolio. Empty
 * until the hiring issues add their actions, so no control is shown that does
 * nothing yet:
 * - #4 (Hire Lead) adds "Invite to lead…" for `client`, shown when they have an
 *   open project that needs a Team Lead.
 * - #5 (Hire Devs) adds "Invite to my team…" for `developer`, shown only to
 *   Team Leads with open spots (Team Lead is per project, never a role).
 * They are separate actions with separate labels.
 */
export function actionsFor(portfolio: Portfolio, viewerRole: Role): ReactNode[] {
  const actions: Record<Role, ReactNode[]> = {
    client: [], // #4: <InviteToLead key="invite-to-lead" developerId={portfolio.account_id} />
    developer: [], // #5: <InviteToTeam key="invite-to-team" developerId={portfolio.account_id} />
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
