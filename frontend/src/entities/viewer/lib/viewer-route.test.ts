import { describe, expect, it } from "vitest";

import { routeFor } from "./viewer-route";

const account = {
  id: 1,
  role: "client" as const,
  display_name: "Grace",
  created_at: null,
  profile: { company_name: "Acme", industry: "Retail" },
};

describe("routeFor", () => {
  it("sends signed-out visitors to sign in", () => {
    expect(routeFor({ ok: false, error: { code: "UNAUTHENTICATED", message: "x" } })).toEqual({
      kind: "sign-in",
    });
  });

  it("sends users without an account to onboarding, and onboarded users never there", () => {
    expect(routeFor({ ok: true, data: { clerk_user_id: "u", account: null } }).kind).toBe("onboarding");
    expect(routeFor({ ok: true, data: { clerk_user_id: "u", account } })).toMatchObject({
      kind: "dashboard",
      viewer: { account: { role: "client" } },
    });
  });

  it("reports other failures as an error to retry", () => {
    expect(routeFor({ ok: false, error: { code: "UNREACHABLE", message: "Down." } })).toEqual({
      kind: "error",
      message: "Down.",
    });
  });
});
