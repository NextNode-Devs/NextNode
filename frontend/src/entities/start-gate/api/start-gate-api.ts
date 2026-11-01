import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { DepositPreview, OfferBody, StartGate } from "../model/start-gate";

/** Any client that can GET: the browser client or the server one (`authedServerApi`). */
type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

export function getStartGate(api: ApiGetter, projectId: number): Promise<ApiResult<StartGate>> {
  return api.get<StartGate>(`/api/projects/${projectId}/start/`);
}

export function closeProposal(api: BrowserApi, projectId: number): Promise<ApiResult<StartGate>> {
  return api.post<StartGate>(`/api/projects/${projectId}/close-proposal/`);
}

export function sendOffer(api: BrowserApi, projectId: number, body: OfferBody): Promise<ApiResult<StartGate>> {
  return api.post<StartGate>(`/api/projects/${projectId}/offers/`, body);
}

/** The deposit the server would ask for this total. Never computed in the browser. */
export function previewDeposit(
  api: BrowserApi,
  projectId: number,
  totalCents: number,
): Promise<ApiResult<DepositPreview>> {
  return api.get<DepositPreview>(`/api/projects/${projectId}/offers/deposit-preview/?total_cents=${totalCents}`);
}

export function acceptOffer(api: BrowserApi, offerId: number): Promise<ApiResult<StartGate>> {
  return api.post<StartGate>(`/api/offers/${offerId}/accept/`);
}

export function declineOffer(api: BrowserApi, offerId: number, reason: string): Promise<ApiResult<StartGate>> {
  return api.post<StartGate>(`/api/offers/${offerId}/decline/`, { reason });
}

export function finalizeTimeline(
  api: BrowserApi,
  projectId: number,
  body: { start_date: string; delivery_date: string },
): Promise<ApiResult<StartGate>> {
  return api.post<StartGate>(`/api/projects/${projectId}/timeline/`, body);
}
