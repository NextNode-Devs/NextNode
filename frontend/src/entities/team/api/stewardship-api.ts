import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { Stewardship } from "../model/stewardship";

type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

const base = (projectId: number) => `/api/projects/${projectId}`;

export function getStewardship(api: ApiGetter, projectId: number): Promise<ApiResult<Stewardship>> {
  return api.get<Stewardship>(`${base(projectId)}/stewardship/`);
}

/** The Team Lead chooses (or replaces) the Assistant Lead. */
export function chooseAssistantLead(
  api: BrowserApi,
  projectId: number,
  accountId: number,
): Promise<ApiResult<Stewardship>> {
  return api.put<Stewardship>(`${base(projectId)}/assistant-lead/`, { account_id: accountId });
}

/** A member answers "Yes, this project is still active". */
export function confirmProjectActive(api: BrowserApi, projectId: number): Promise<ApiResult<Stewardship>> {
  return api.post<Stewardship>(`${base(projectId)}/activity-check/confirm/`);
}

/** The Team Lead or the Assistant Lead closes the developer project. */
export function closeDeveloperProject(api: BrowserApi, projectId: number): Promise<ApiResult<Stewardship>> {
  return api.post<Stewardship>(`${base(projectId)}/close/`);
}
