import "server-only";

import { auth } from "@clerk/nextjs/server";

import { isAuthConfigured } from "@/shared/config/env.public";

/**
 * The signed-in user's Clerk session token, for `Authorization: Bearer` on
 * calls to Django. `null` when signed out or when Clerk is not configured, so
 * protected endpoints answer 401 and screens show their signed-out state.
 */
export async function getSessionToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  return (await auth()).getToken();
}
