/** Mirrors `GET /api/projects/{id}/stewardship/` (NN-39): the Assistant Lead and
 * the inactivity check on developer projects. Client projects have neither. */

/** Same shape as `entities/project`'s `Person`; entities never import each other. */
type Person = { account_id: number; display_name: string };

export type ActivityCheckStatus = "pending" | "confirmed" | "lead_returned" | "closed";

export type ActivityCheck = {
  status: ActivityCheckStatus;
  question: string;
  started_at: string | null;
  answer_by: string | null;
  ended_at: string | null;
  answered_by: Person | null;
};

/** `available: false` means planned: the screen says so and offers no control for it. */
export type AssistantLeadPermission = { label: string; available: boolean };

export type Stewardship = {
  project_id: number;
  project_status: string;
  assistant_lead: Person | null;
  assistant_lead_can: AssistantLeadPermission[];
  assistant_lead_cannot: string[];
  lead_last_active_at: string | null;
  /** When the members are asked, if the Team Lead stays silent in the project chat until then. */
  activity_check_due_at: string | null;
  /** The pending check, else the latest one that ended. */
  activity_check: ActivityCheck | null;
  hidden_from_feed: boolean;
  members: Person[];
  actions: { choose_assistant_lead: boolean; confirm_active: boolean; close_project: boolean };
};

/** One sentence for an ended check. */
export function endedCheckText(check: ActivityCheck): string {
  switch (check.status) {
    case "confirmed":
      return `${check.answered_by?.display_name ?? "A member"} confirmed the project is still active.`;
    case "lead_returned":
      return "The Team Lead is active again.";
    case "closed":
      return "Nobody confirmed in time, so the project was closed.";
    case "pending":
      return check.question;
  }
}
