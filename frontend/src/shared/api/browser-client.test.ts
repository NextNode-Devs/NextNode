import { afterEach, describe, expect, it, vi } from "vitest";

import { createBrowserApi } from "./browser-client";

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ getToken: async () => null }) }));

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("createBrowserApi", () => {
  it("sends the Clerk token as a bearer header and unwraps data", async () => {
    const fetch = stubFetch(200, { data: [{ key: "react", label: "React" }] });
    const api = createBrowserApi(async () => "tok_1", "http://api.test");
    const result = await api.get("/api/skills/?q=re");
    expect(result).toEqual({ ok: true, data: [{ key: "react", label: "React" }] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/api/skills/?q=re");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok_1");
  });

  it("omits the header when signed out and returns the API error", async () => {
    const fetch = stubFetch(401, { error: { code: "UNAUTHENTICATED", message: "Sign in." } });
    const result = await createBrowserApi(async () => null, "http://api.test").post("/api/x/", {});
    expect(result).toEqual({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in." } });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("never throws when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const result = await createBrowserApi(async () => "t", "http://api.test").get("/api/me/");
    expect(result).toMatchObject({ ok: false, error: { code: "UNREACHABLE" } });
  });
});
