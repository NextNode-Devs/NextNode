import "server-only";

import { connection } from "next/server";

import { getServerEnv } from "@/shared/config/env.server";

import { getSessionToken } from "./session";
import { readEnvelope, UNREACHABLE, type ApiResult, type HttpMethod } from "./types";

export type { ApiError, ApiResult } from "./types";

type RequestOptions = {
  timeoutMs?: number;
  /** Send the signed-in user's Clerk session token as `Authorization: Bearer`. */
  auth?: boolean;
};

const DEFAULT_TIMEOUT_MS = 3000;

async function apiRequest<T>(
  method: HttpMethod,
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
    return await readEnvelope<T>(response);
  } catch {
    return { ok: false, error: UNREACHABLE };
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

/** PUT, for whole-resource updates (e.g. #2's portfolio). Never throws. */
export function apiPut<T>(path: string, body?: unknown, init?: RequestOptions): Promise<ApiResult<T>> {
  return apiRequest<T>("PUT", path, { ...init, body });
}

/** PATCH, for partial updates. Never throws. */
export function apiPatch<T>(path: string, body?: unknown, init?: RequestOptions): Promise<ApiResult<T>> {
  return apiRequest<T>("PATCH", path, { ...init, body });
}

/** `{ get }` with the signed-in user's token, for slice API functions that take a client. */
export const authedServerApi = {
  get: <T,>(path: string): Promise<ApiResult<T>> => apiGet<T>(path, { auth: true }),
};
