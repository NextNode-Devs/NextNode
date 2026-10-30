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
  /** Whether the Clerk secret key is present. The value itself is never exposed. */
  clerkSecretConfigured: boolean;
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
    clerkSecretConfigured: readClerkSecret(),
  };
  return cached;
}

/** Clerk's SDK reads `CLERK_SECRET_KEY` itself; this only checks it is present
 * whenever the publishable key is, so sign-in can't half-work. */
function readClerkSecret(): boolean {
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (publishable && !secret) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set but CLERK_SECRET_KEY is not. See frontend/.env.example.",
    );
  }
  if (secret && !/^sk_(test|live)_/.test(secret)) {
    throw new Error("CLERK_SECRET_KEY must start with sk_test_ or sk_live_.");
  }
  return Boolean(secret);
}

export function assertServerEnv(): void {
  getServerEnv();
}
