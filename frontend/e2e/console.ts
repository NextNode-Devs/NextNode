import type { ConsoleMessage } from "@playwright/test";

/**
 * Whether a browser console message counts as a problem: any error, and any
 * hydration warning.
 *
 * One error is left out. A link prefetch that lands while Clerk is refreshing
 * the 60-second session token is answered 404 by `auth.protect()` in
 * `src/proxy.ts` (Clerk returns 404, not a redirect, for non-page requests),
 * and the browser logs it. Next.js then navigates normally, so nothing breaks.
 * Only that exact request is ignored: a 404 for `/sign-in?…&_rsc=…`.
 */
export function isConsoleProblem(message: ConsoleMessage): boolean {
  if (message.type() !== "error" && !/hydrat/i.test(message.text())) return false;
  return !isSignInPrefetch404(message);
}

function isSignInPrefetch404(message: ConsoleMessage): boolean {
  if (!/status of 404/.test(message.text())) return false;
  const url = new URL(message.location().url, "http://localhost");
  return url.pathname === "/sign-in" && url.searchParams.has("_rsc");
}
