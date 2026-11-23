import { sampleInbox, type InboxItem } from "@/entities/conversation";
import { PROJECT_ROLES, sampleDashboard, type ProjectRole, type SampleDashboard } from "@/entities/project";
import { latestUpdate, type ProjectUpdate } from "@/entities/project-update";
import type { ApiResult } from "@/shared/api/types";

export type RoleFilter = "all" | ProjectRole;

export type OverviewData = SampleDashboard & { inbox: InboxItem[] };

/**
 * PROTOTYPE: what the planned `GET /api/dashboard/` returns, from sample data.
 * Shaped as an API result so the screen already handles a failed load.
 */
export function loadSampleOverview(accountRole: "developer" | "client"): ApiResult<OverviewData> {
  return { ok: true, data: { ...sampleDashboard(accountRole), inbox: sampleInbox(accountRole) } };
}

/** The roles the viewer actually holds, in filter order, each with how many projects. */
export function roleOptions(projects: readonly { role: ProjectRole }[]): { role: ProjectRole; count: number }[] {
  return PROJECT_ROLES.map((role) => ({ role, count: projects.filter((p) => p.role === role).length })).filter(
    (option) => option.count > 0,
  );
}

/** Items for one role. Items with no role (an invitation to a project they aren't on) show under All only. */
export function byRole<T extends { role: ProjectRole | null }>(items: readonly T[], filter: RoleFilter): T[] {
  return filter === "all" ? [...items] : items.filter((item) => item.role === filter);
}

/** The newest update on one project, if it has any. */
export function latestUpdateFor(projectId: number, updates: readonly ProjectUpdate[]): ProjectUpdate | undefined {
  return latestUpdate(updates.filter((update) => update.project_id === projectId));
}
