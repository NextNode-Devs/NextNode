import "server-only";

import { connection } from "next/server";

import { getServerEnv } from "@/shared/config/env.server";

/** Mirrors the backend envelope: `{ data }` on success, `{ error }` on failure. */
export type ApiError = { code: string; message: string; fields?: Record<string, string[]> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * GET a JSON endpoint of the Django API from the Next.js server.
 * Never throws for network or HTTP failures: callers render an error state.
 */
export async function apiGet<T>(path: string, init?: { timeoutMs?: number }): Promise<ApiResult<T>> {
  // API data is per-request: never read it (or the runtime config) at build time.
  await connection();
  const url = `${getServerEnv().apiBaseUrl}${path}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as
      | { data: T }
      | { error: ApiError }
      | null;

    if (response.ok && body && "data" in body) return { ok: true, data: body.data };
    if (body && "error" in body) return { ok: false, error: body.error };
    return {
      ok: false,
      error: { code: "BAD_RESPONSE", message: `The API answered ${response.status} without a readable body.` },
    };
  } catch {
    return {
      ok: false,
      error: { code: "UNREACHABLE", message: "The API could not be reached." },
    };
  }
}
