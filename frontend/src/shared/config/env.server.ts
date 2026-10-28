import "server-only";

/**
 * Server-only configuration. The only module that reads `process.env` for
 * server values; importing it from a client component fails the build.
 *
 * Values are read lazily so `next build` does not need runtime settings;
 * `src/instrumentation.ts` calls `assertServerEnv()` when the server starts,
 * so a misconfigured server fails before it serves a request.
 */
type ServerEnv = {
  /** Base URL of the Django API as reached from the Next.js server. */
  apiBaseUrl: string;
};

function readUrl(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See frontend/.env.example.`);
  }
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Environment variable ${name} must be an absolute URL, got "${value}".`);
  }
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= {
    apiBaseUrl: readUrl(
      "API_BASE_URL",
      process.env.NODE_ENV === "production" ? undefined : "http://localhost:8000",
    ),
  };
  return cached;
}

export function assertServerEnv(): void {
  getServerEnv();
}
