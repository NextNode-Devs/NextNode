import "server-only";

import { cache } from "react";

import { apiGet, type ApiResult } from "@/shared/api/server-client";

import type { Viewer } from "../model/viewer";

/** The signed-in user and their account; fetched once per request. */
export const getViewer = cache((): Promise<ApiResult<Viewer>> => apiGet<Viewer>("/api/me/", { auth: true }));
