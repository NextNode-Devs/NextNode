/** Mirrors `GET /api/lead-candidacies/{id}/` (#4, Hire Lead). */
export type LeadStatus = "invited" | "candidate" | "hired" | "declined" | "withdrawn" | "closed";

export type LeadActions = { accept: boolean; decline: boolean; withdraw: boolean; hire: boolean };

export type LeadCandidacy = {
  id: string;
  project_id: number;
  client_account_id: number;
  developer_account_id: number;
  kind: "application" | "invitation";
  status: LeadStatus;
  note: string;
  conversation_id: string | null;
  created_at: string | null;
  decided_at: string | null;
  actions: LeadActions;
};

/**
 * One plain sentence saying where this candidacy stands, from the viewer's
 * side. `developer` is the developer's name as the client sees it.
 */
export function leadStatusText(candidacy: LeadCandidacy, viewerId: number, developer: string): string {
  const mine = viewerId === candidacy.developer_account_id;
  const application = candidacy.kind === "application";
  switch (candidacy.status) {
    case "invited":
      return mine
        ? "You've been invited to lead this project. Accepting makes you a candidate; the client then decides."
        : `Invitation sent. Waiting for ${developer} to accept or decline.`;
    case "candidate":
      if (mine) {
        return application
          ? "You've applied to lead this project. The client decides here."
          : "You accepted the invitation and are a candidate. The client decides here.";
      }
      return `${developer} is a candidate to lead this project. Hire them here when you're ready.`;
    case "hired":
      return mine ? "You were hired as Team Lead of this project." : `You hired ${developer} as Team Lead.`;
    case "declined":
      return mine ? "You declined this invitation." : `${developer} declined the invitation.`;
    case "withdrawn":
      return mine ? "You withdrew your application." : `${developer} withdrew their application.`;
    case "closed":
      return "Another candidate was hired as Team Lead.";
  }
}
