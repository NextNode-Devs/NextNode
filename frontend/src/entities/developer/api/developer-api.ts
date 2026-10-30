import type { ApiResult } from "@/shared/api/types";

import { directoryQuery, type DirectoryFilters } from "../lib/directory-params";
import type { DirectoryPage, Portfolio } from "../model/developer";

/** Any client that can GET: the browser client, or a server-side wrapper of `apiGet`. */
export type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

export const portfolioHref = (accountId: number) => `/developers/${accountId}`;

export function getPortfolio(api: ApiGetter, accountId: number): Promise<ApiResult<Portfolio>> {
  return api.get<Portfolio>(`/api/developers/${accountId}/`);
}

export function getMyPortfolio(api: ApiGetter): Promise<ApiResult<Portfolio>> {
  return api.get<Portfolio>("/api/developers/me/portfolio/");
}

export function searchDevelopers(api: ApiGetter, filters: DirectoryFilters): Promise<ApiResult<DirectoryPage>> {
  return api.get<DirectoryPage>(`/api/developers/${directoryQuery(filters)}`);
}
