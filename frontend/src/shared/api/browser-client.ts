"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

import { publicEnv } from "@/shared/config/env.public";

import { readEnvelope, UNREACHABLE, type ApiResult, type HttpMethod } from "./types";

export type { ApiError, ApiResult } from "./types";

type GetToken = () => Promise<string | null>;

export type BrowserApi = {
  get<T>(path: string): Promise<ApiResult<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  put<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  /** POST a multipart form (file uploads). The browser sets the boundary header. */
  postForm<T>(path: string, form: FormData): Promise<ApiResult<T>>;
};

const TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** A Django API client for client components. Exported for tests; use `useApiClient`. */
export function createBrowserApi(getToken: GetToken, baseUrl = publicEnv.apiBaseUrl): BrowserApi {
  async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = await getToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(isForm ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
      });
      return await readEnvelope<T>(response);
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  }
  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    postForm: (path, form) => request("POST", path, form),
  };
}

/** The browser client with the current Clerk session token attached. Never throws. */
export function useApiClient(): BrowserApi {
  const { getToken } = useAuth();
  return useMemo(() => createBrowserApi(() => getToken()), [getToken]);
}
