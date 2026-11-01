/** Mirrors the Hire Devs responses (#5). Never conflated with Hire Lead: those
 * are `entities/lead-candidacy`, with their own records and screens. */

/** Total people on a team, the Team Lead included. The backend stays the authority. */
export const TEAM_SIZES = [5, 6, 7] as const;

export type TeamMember = {
  account_id: number;
  display_name: string;
  role: "lead" | "member";
  joined_at: string | null;
  portfolio_url: string;
};

/** `GET /api/projects/{id}/team/`: the Team Lead first. */
export type TeamProfile = {
  size: number | null;
  open_spots: number;
  status: "open" | "locked" | "active" | "archived";
  members: TeamMember[];
};

export type CandidacyKind = "application" | "invitation";

export type CandidacyStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "declined" | "closed";

export type CandidacyActions = { accept: boolean; reject: boolean; withdraw: boolean; decline: boolean };

/** `GET /api/team-candidacies/{id}/`, and what every decision returns. */
export type TeamCandidacy = {
  id: string;
  project_id: number;
  lead_account_id: number;
  developer_account_id: number;
  kind: CandidacyKind;
  status: CandidacyStatus;
  closed_reason: string;
  conversation_id: string | null;
  created_at: string | null;
  decided_at: string | null;
  actions: CandidacyActions;
};

/** `GET /api/team-candidacies/mine/`: the viewer's, newest first. */
export type MyTeamCandidacy = {
  candidacy_id: string;
  project_id: number;
  project_title: string;
  kind: CandidacyKind;
  status: CandidacyStatus;
  closed_reason: string;
  my_part: "lead" | "developer";
  lead_name: string;
  developer_name: string;
  conversation_id: string | null;
  created_at: string | null;
  actions: CandidacyActions;
};

/** A one-word status for lists and badges. */
export const CANDIDACY_STATUS_TAG: Record<CandidacyStatus, string> = {
  pending: "Pending",
  accepted: "Joined",
  rejected: "Rejected",
  withdrawn: "Withdrew",
  declined: "Declined",
  closed: "Closed",
};

/** Where an application or invitation is discussed and decided. */
export const candidacyHref = (item: Pick<MyTeamCandidacy, "conversation_id" | "project_id">) =>
  item.conversation_id ? `/conversations/${item.conversation_id}` : `/projects/${item.project_id}`;

/** One plain sentence saying where this candidacy stands, from the viewer's side. */
export function candidacyStatusText(candidacy: TeamCandidacy, viewerId: number, developer: string): string {
  const mine = viewerId === candidacy.developer_account_id;
  const application = candidacy.kind === "application";
  switch (candidacy.status) {
    case "pending":
      if (application) {
        return mine
          ? "You've applied to join this team. The Team Lead decides here."
          : `${developer} applied to join your team. Accept or reject them here.`;
      }
      return mine
        ? "You've been invited to join this team. You join only if you accept."
        : `Invitation sent. Waiting for ${developer} to accept or decline.`;
    case "accepted":
      return mine ? "You're on this team." : `${developer} joined your team.`;
    case "rejected":
      return mine ? "The Team Lead turned down your application." : `You turned down ${developer}'s application.`;
    case "withdrawn":
      return mine ? "You withdrew your application." : `${developer} withdrew their application.`;
    case "declined":
      return mine ? "You declined this invitation." : `${developer} declined the invitation.`;
    case "closed":
      return `${application ? "This application" : "This invitation"} is closed: ${candidacy.closed_reason}.`;
  }
}
