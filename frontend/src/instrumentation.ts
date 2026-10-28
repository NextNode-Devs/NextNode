/** Runs once when a Next.js server starts: fail fast on missing configuration. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertServerEnv } = await import("@/shared/config/env.server");
  assertServerEnv();
}
