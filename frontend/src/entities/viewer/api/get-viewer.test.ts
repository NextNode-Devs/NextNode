import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/shared/api/server-client";

import { getViewer, VIEWER_TIMEOUT_MS } from "./get-viewer";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/shared/config/env.server", () => ({ getServerEnv: () => ({ apiBaseUrl: "http://api.test" }) }));
vi.mock("@/shared/api/session", () => ({ getSessionToken: async () => "tok" }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const VIEWER = { clerk_user_id: "user_1", account: null };

/** A fetch that answers after `delayMs` of (fake) time, or fails when its signal aborts first. */
function slowFetch(delayMs: number, status: number, body: unknown) {
  return vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response(JSON.stringify(body), { status })), delayMs);
        init.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "TimeoutError"));
        });
      }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  // The real AbortSignal.timeout ignores fake timers; build the same thing from setTimeout.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getViewer", () => {
  it("waits for /api/me/ when Clerk's signing keys take longer than 3 seconds", async () => {
    vi.stubGlobal("fetch", slowFetch(5000, 200, { data: VIEWER }));
    const pending = getViewer();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ ok: true, data: VIEWER });
  });

  it("still reports unreachable once the longer limit passes", async () => {
    vi.stubGlobal("fetch", slowFetch(VIEWER_TIMEOUT_MS + 1000, 200, { data: VIEWER }));
    const pending = getViewer();
    await vi.advanceTimersByTimeAsync(VIEWER_TIMEOUT_MS);
    expect(await pending).toMatchObject({ ok: false, error: { code: "UNREACHABLE" } });
  });

  it.each([401, 403])("returns a %i as an API error, not as unreachable", async (status) => {
    const error = { code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message: "No." };
    vi.stubGlobal("fetch", slowFetch(0, status, { error }));
    const pending = getViewer();
    await vi.advanceTimersByTimeAsync(0);
    expect(await pending).toEqual({ ok: false, error });
  });

  it("leaves every other endpoint on the 3 second default", async () => {
    vi.stubGlobal("fetch", slowFetch(5000, 200, { data: {} }));
    const pending = apiGet("/api/health/");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toMatchObject({ ok: false, error: { code: "UNREACHABLE" } });
  });
});
