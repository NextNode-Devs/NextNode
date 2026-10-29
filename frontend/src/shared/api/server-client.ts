import "server-only";

import { connection } from "next/server";

import { getServerEnv } from "@/shared/config/env.server";

import { getSessionToken } from "./session";

/** Mirrors the backend envelope: `{ data }` on success, `{ error }` on failure. */
export type ApiError = { code: string; message: string; fields?: Record<string, string[]> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

type RequestOptions = {
  timeoutMs?: number;
  /** Send the signed-in user's Clerk session token as `Authorization: Bearer`. */
  auth?: boolean;
};

const DEFAULT_TIMEOUT_MS = 3000;

async function apiRequest<T>(
  method: "GET" | "POST",
  path: string,
  init: RequestOptions & { body?: unknown } = {},
): Promise<ApiResult<T>> {
  // API data is per-request: never read it (or the runtime config) at build time.
  await connection();
  const url = `${getServerEnv().apiBaseUrl}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.auth) {
    const token = await getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
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

/**
 * GET a JSON endpoint of the Django API from the Next.js server.
 * Never throws for network or HTTP failures: callers render an error state.
 */
export function apiGet<T>(path: string, init?: RequestOptions): Promise<ApiResult<T>> {
  return apiRequest<T>("GET", path, init);
}

/** POST to the Django API from the Next.js server. Never throws, like `apiGet`. */
export function apiPost<T>(path: string, body?: unknown, init?: RequestOptions): Promise<ApiResult<T>> {
  return apiRequest<T>("POST", path, { ...init, body });
}
