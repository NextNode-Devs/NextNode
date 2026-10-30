/**
 * Browser-safe configuration: `NEXT_PUBLIC_*` values only, inlined by Next at
 * build time. Each one is read with a literal `process.env.NEXT_PUBLIC_…`
 * expression, because Next only inlines those. Never put a secret here.
 */
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function url(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/$/, "");
}

export const publicEnv = {
  /** Empty when Clerk is not set up: sign-in screens say so instead of crashing. */
  clerkPublishableKey,
  /** Django API as reached from the browser (CORS allows FRONTEND_ORIGIN). */
  apiBaseUrl: url(process.env.NEXT_PUBLIC_API_BASE_URL, "http://localhost:8000"),
  /** Django Channels endpoint for the authenticated socket. */
  wsUrl: url(process.env.NEXT_PUBLIC_WS_URL, "ws://localhost:8000/ws"),
} as const;

export function isAuthConfigured(): boolean {
  return /^pk_(test|live)_/.test(publicEnv.clerkPublishableKey);
}
