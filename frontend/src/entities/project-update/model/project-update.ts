/**
 * A post in a project's updates feed (NN-15b, #92): news the client and the
 * whole team should see. Planned API shape: the real version is a
 * ProjectUpdate row whose access follows team membership. Each post belongs
 * to the milestone in progress when it was written (none before work starts).
 */

export type UpdateAuthorRole = "client" | "lead" | "member";

export const UPDATE_AUTHOR_ROLE_LABEL: Record<UpdateAuthorRole, string> = {
  client: "Client",
  lead: "Team Lead",
  member: "Developer",
};

export type ProjectUpdate = {
  id: number;
  project_id: number;
  author: { account_id: number; display_name: string; role: UpdateAuthorRole };
  body: string;
  created_at: string;
  /** The milestone in progress when it was posted; `null` before work started. */
  milestone_sequence: number | null;
};

export const PROJECT_UPDATE_LIMITS = { bodyMax: 1000 } as const;

export type UpdateGroup = { milestone_sequence: number | null; updates: ProjectUpdate[] };

const newestFirst = (a: ProjectUpdate, b: ProjectUpdate) => Date.parse(b.created_at) - Date.parse(a.created_at);

/** Updates grouped by milestone, latest milestone first, "before work started" last; newest post first in each. */
export function groupUpdatesByMilestone(updates: readonly ProjectUpdate[]): UpdateGroup[] {
  const groups = new Map<number | null, ProjectUpdate[]>();
  for (const update of updates) {
    const key = update.milestone_sequence;
    groups.set(key, [...(groups.get(key) ?? []), update]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(([milestone_sequence, items]) => ({ milestone_sequence, updates: [...items].sort(newestFirst) }));
}

/** The newest update, e.g. for the dashboard's "latest update" (NN-32). */
export function latestUpdate(updates: readonly ProjectUpdate[]): ProjectUpdate | undefined {
  return [...updates].sort(newestFirst)[0];
}
