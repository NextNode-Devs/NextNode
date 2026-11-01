import "server-only";

import { apiGet, type ApiResult } from "@/shared/api/server-client";

import type { Deposit } from "../model/deposit";

/** Start-gate status from #6. Only who is asking and the `deposit` part are read here. */
type StartGate = { viewer_role: "client" | "lead" | "member"; deposit: Deposit };

/**
 * The project's deposit, from `GET /api/projects/{id}/start/` (#6). The
 * backend refuses anyone outside the project (403/404). The gate is also
 * shown to the Team Lead and members, but the payment pages are the
 * client's alone, so they get the same refusal.
 */
export async function getDeposit(projectId: string): Promise<ApiResult<Deposit>> {
  const result = await apiGet<StartGate>(`/api/projects/${projectId}/start/`, { auth: true });
  if (!result.ok) return result;
  if (result.data.viewer_role !== "client") {
    return { ok: false, error: { code: "FORBIDDEN", message: "Only the project's client can see its deposit." } };
  }
  return { ok: true, data: result.data.deposit };
}
