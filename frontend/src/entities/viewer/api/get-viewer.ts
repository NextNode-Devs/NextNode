import "server-only";

import { cache } from "react";

import { apiGet, type ApiResult } from "@/shared/api/server-client";

import type { Viewer } from "../model/viewer";

/**
 * Django's first call after a start fetches Clerk's signing keys, which can
 * take ~5 s, so this endpoint gets more room than the 3 s default. 401/403
 * still come back as API errors; only a real timeout reads as unreachable.
 */
export const VIEWER_TIMEOUT_MS = 10_000;

/** The signed-in user and their account; fetched once per request. */
export const getViewer = cache((): Promise<ApiResult<Viewer>> => 
  apiGet<Viewer>("/api/me/", { auth: true, timeoutMs: VIEWER_TIMEOUT_MS }),
);
