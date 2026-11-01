import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "@/shared/api/server-client";

import { startDepositCheckout } from "./start-deposit-checkout";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/shared/api/server-client", () => ({ apiPost: vi.fn() }));

function serverSends(checkoutUrl: string) {
  vi.mocked(apiPost).mockResolvedValue({
    ok: true,
    data: { checkout_url: checkoutUrl, payment_id: "p1", amount_cents: 30_000, currency: "cad" },
  });
}

describe("startDepositCheckout", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("sends the client to Stripe Checkout", async () => {
    serverSends("https://checkout.stripe.com/c/pay/cs_test_1");
    await expect(startDepositCheckout("7")).rejects.toThrow("redirect:https://checkout.stripe.com/c/pay/cs_test_1");
  });

  it("follows CI's fake checkout to this project's return page, as a path", async () => {
    serverSends("http://localhost:3100/projects/7/deposit/return?session_id=cs_fake_1");
    await expect(startDepositCheckout("7")).rejects.toThrow("redirect:/projects/7/deposit/return?session_id=cs_fake_1");
  });

  it.each([
    "https://evil.example/pay",
    "http://localhost:3100/projects/8/deposit/return?session_id=cs_fake_1",
    "http://localhost:3100/projects/7/deposit/cancelled",
    "not a url",
  ])("refuses any other link: %s", async (url) => {
    serverSends(url);
    expect(await startDepositCheckout("7")).toEqual({
      error: { code: "BAD_RESPONSE", message: "The checkout link from the server was not a Stripe link." },
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
