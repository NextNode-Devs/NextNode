import { describe, expect, it, vi } from "vitest";

import { apiGet } from "@/shared/api/server-client";

import { getDeposit } from "./get-deposit";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/api/server-client", () => ({ apiGet: vi.fn() }));

const DEPOSIT = { status: "pending", amount_cents: 30_000, currency: "cad" };

describe("getDeposit", () => {
  it("gives the project's client their deposit", async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: { viewer_role: "client", deposit: DEPOSIT } });
    expect(await getDeposit("7")).toEqual({ ok: true, data: DEPOSIT });
    expect(apiGet).toHaveBeenCalledWith("/api/projects/7/start/", { auth: true });
  });

  it.each(["lead", "member"])("refuses the %s: the payment pages are the client's alone", async (role) => {
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: { viewer_role: role, deposit: DEPOSIT } });
    const result = await getDeposit("7");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });

  it("passes the backend's refusal through", async () => {
    const error = { code: "NOT_FOUND", message: "Project not found." };
    vi.mocked(apiGet).mockResolvedValue({ ok: false, error });
    expect(await getDeposit("7")).toEqual({ ok: false, error });
  });
});
