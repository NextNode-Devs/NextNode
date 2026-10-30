import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { LeadCandidacy } from "../model/lead-candidacy";

export type LeadDecision = "accept" | "decline" | "withdraw" | "hire";

const DECISION_PATH: Record<LeadDecision, (id: string) => string> = {
  accept: (id) => `/api/lead-invitations/${id}/accept/`,
  decline: (id) => `/api/lead-invitations/${id}/decline/`,
  withdraw: (id) => `/api/lead-applications/${id}/withdraw/`,
  hire: (id) => `/api/lead-candidacies/${id}/hire/`,
};

export function getLeadCandidacy(api: BrowserApi, id: string): Promise<ApiResult<LeadCandidacy>> {
  return api.get<LeadCandidacy>(`/api/lead-candidacies/${id}/`);
}

export function decideLeadCandidacy(
  api: BrowserApi,
  id: string,
  decision: LeadDecision,
): Promise<ApiResult<LeadCandidacy>> {
  return api.post<LeadCandidacy>(DECISION_PATH[decision](id));
}

export function applyToLead(api: BrowserApi, projectId: number, note: string): Promise<ApiResult<LeadCandidacy>> {
  return api.post<LeadCandidacy>(`/api/projects/${projectId}/lead-applications/`, { note });
}
