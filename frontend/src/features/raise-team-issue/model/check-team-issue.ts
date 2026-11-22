/** What a team member can raise with their Team Lead (planned API shape, NN-40). */
export const TEAM_ISSUE_TOPICS = ["workload", "communication", "deadlines", "other"] as const;
export type TeamIssueTopic = (typeof TEAM_ISSUE_TOPICS)[number];

export const TEAM_ISSUE_TOPIC_LABEL: Record<TeamIssueTopic, string> = {
  workload: "Workload or task split",
  communication: "Communication in the team",
  deadlines: "Deadlines or milestones",
  other: "Something else",
};

export const TEAM_ISSUE_MIN_LENGTH = 20;
export const TEAM_ISSUE_MAX_LENGTH = 1000;

export type TeamIssueDraft = { topic: TeamIssueTopic | ""; details: string };
export type TeamIssueErrors = Partial<Record<keyof TeamIssueDraft, string>>;

export const EMPTY_TEAM_ISSUE: TeamIssueDraft = { topic: "", details: "" };

/** Checks the fields the way the planned endpoint would; an empty object means valid. */
export function checkTeamIssue(draft: TeamIssueDraft): TeamIssueErrors {
  const errors: TeamIssueErrors = {};
  if (!draft.topic) errors.topic = "Choose what the issue is about.";
  const details = draft.details.trim();
  if (!details) errors.details = "Describe the issue.";
  else if (details.length < TEAM_ISSUE_MIN_LENGTH)
    errors.details = `Add a little more detail (at least ${TEAM_ISSUE_MIN_LENGTH} characters).`;
  else if (details.length > TEAM_ISSUE_MAX_LENGTH)
    errors.details = `Keep it under ${TEAM_ISSUE_MAX_LENGTH} characters.`;
  return errors;
}
