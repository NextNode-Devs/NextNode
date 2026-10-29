import "server-only";

import { apiGet, type ApiResult } from "@/shared/api/server-client";

import type { Deposit } from "../model/deposit";

/** Start-gate status from #6. Only the `deposit` part is read here. */
type StartGate = { deposit: Deposit };

/**
 * The project's deposit, from `GET /api/projects/{id}/start/` (#6). The
 * backend decides who may see it; a visitor without access gets 403/404.
 */
export async function getDeposit(projectId: string): Promise<ApiResult<Deposit>> {
  const result = await apiGet<StartGate>(`/api/projects/${projectId}/start/`, { auth: true });
  return result.ok ? { ok: true, data: result.data.deposit } : result;
}
