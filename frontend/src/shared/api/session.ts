import "server-only";

/**
 * The signed-in user's Clerk session token, for `Authorization: Bearer`.
 *
 * Clerk is wired into the frontend by #1. Until then there is no session, so
 * this returns null and protected endpoints answer 401, which screens render
 * as "sign in required". #1 replaces the body with Clerk's server `auth()`
 * (`(await auth()).getToken()`); no caller changes.
 */
export async function getSessionToken(): Promise<string | null> {
  return null;
}
