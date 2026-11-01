import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { MyTeamCandidacy, TeamCandidacy, TeamProfile } from "../model/team";

export type TeamDecision = "accept" | "reject" | "withdraw" | "decline";

/** Any client that can GET: the browser client or the server one (`authedServerApi`). */
type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

const decisionPath = ({ id, kind }: Pick<TeamCandidacy, "id" | "kind">, decision: TeamDecision) =>
  `/api/${kind === "application" ? "team-applications" : "team-invitations"}/${id}/${decision}/`;

export function getTeam(api: ApiGetter, projectId: number): Promise<ApiResult<TeamProfile>> {
  return api.get<TeamProfile>(`/api/projects/${projectId}/team/`);
}

export function setTeamSize(api: BrowserApi, projectId: number, size: number): Promise<ApiResult<unknown>> {
  return api.put(`/api/projects/${projectId}/team/size/`, { size });
}

export function applyToJoin(api: BrowserApi, projectId: number): Promise<ApiResult<TeamCandidacy>> {
  return api.post<TeamCandidacy>(`/api/projects/${projectId}/team/applications/`);
}

export function inviteDeveloper(
  api: BrowserApi,
  projectId: number,
  developerAccountId: number,
): Promise<ApiResult<TeamCandidacy>> {
  return api.post<TeamCandidacy>(`/api/projects/${projectId}/team/invitations/`, {
    developer_account_id: developerAccountId,
  });
}

export function getTeamCandidacy(api: ApiGetter, id: string): Promise<ApiResult<TeamCandidacy>> {
  return api.get<TeamCandidacy>(`/api/team-candidacies/${id}/`);
}

export function getMyTeamCandidacies(api: ApiGetter): Promise<ApiResult<MyTeamCandidacy[]>> {
  return api.get<MyTeamCandidacy[]>("/api/team-candidacies/mine/");
}

/** The Team Lead accepts or rejects an application; the invitee accepts or declines an invitation. */
export function decideTeamCandidacy(
  api: BrowserApi,
  candidacy: Pick<TeamCandidacy, "id" | "kind">,
  decision: TeamDecision,
): Promise<ApiResult<TeamCandidacy>> {
  return api.post<TeamCandidacy>(decisionPath(candidacy, decision));
}
