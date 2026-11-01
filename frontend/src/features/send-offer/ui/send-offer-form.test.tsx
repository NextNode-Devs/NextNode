import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { SendOfferForm } from "./send-offer-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));
vi.mock("@/shared/lib/format-date", async (actual) => ({
  ...(await actual<typeof import("@/shared/lib/format-date")>()),
  todayIso: () => "2026-11-01",
}));

const preview = { total_cents: 1_000_000, deposit_cents: 200_000, deposit_percent: 20, currency: "cad" };

function fakeApi(sent: ApiResult<unknown> = { ok: true, data: {} }) {
  return {
    get: vi.fn(async () => ({ ok: true, data: preview })),
    post: vi.fn(async () => sent),
  } as unknown as BrowserApi;
}

async function fill(user: ReturnType<typeof userEvent.setup>, total = "10,000") {
  await user.type(screen.getByLabelText(/Estimate summary/), "Five sprints: booking, payments, admin.");
  await user.type(screen.getByLabelText(/Offer total/), total);
  await user.type(screen.getByLabelText(/Start date/), "2026-11-09");
  await user.type(screen.getByLabelText(/Delivery date/), "2027-02-01");
}

beforeEach(() => refresh.mockClear());

describe("SendOfferForm", () => {
  it("shows the client's proposed budget and the server's deposit for the total", async () => {
    const api = fakeApi();
    render(<SendOfferForm projectId={4} proposedBudgetCents={200_000} api={api} />);
    expect(screen.getByText(/The client proposed CAD 2,000.00/)).toBeInTheDocument();
    await userEvent.setup().type(screen.getByLabelText(/Offer total/), "10000");
    expect(await screen.findByText("CAD 2,000.00")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/projects/4/offers/deposit-preview/?total_cents=1000000");
  });

  it("signs and sends the offer in cents", async () => {
    const api = fakeApi();
    render(<SendOfferForm projectId={4} proposedBudgetCents={200_000} api={api} />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /Sign and send offer/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/projects/4/offers/", {
        summary: "Five sprints: booking, payments, admin.",
        total_cents: 1_000_000,
        start_date: "2026-11-09",
        delivery_date: "2027-02-01",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Offer signed and sent");
    expect(refresh).toHaveBeenCalled();
  });

  it("puts the API's refusal on the total field and in a banner", async () => {
    const api = fakeApi({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The offer total must be at least CAD 1,500.00; this is CAD 1,499.99.",
        fields: { total_cents: ["Must be at least CAD 1,500.00."] },
      },
    });
    render(<SendOfferForm projectId={4} proposedBudgetCents={200_000} api={api} />);
    const user = userEvent.setup();
    await fill(user, "1500"); // passes the browser's check; the server still has the last word
    await user.click(screen.getByRole("button", { name: /Sign and send offer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least CAD 1,500.00; this is CAD 1,499.99");
    expect(screen.getByLabelText(/Offer total/)).toHaveAttribute("aria-invalid", "true");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses a total below the minimum before sending anything", async () => {
    const api = fakeApi();
    render(<SendOfferForm projectId={4} proposedBudgetCents={200_000} api={api} />);
    const user = userEvent.setup();
    await fill(user, "1499.99");
    await user.click(screen.getByRole("button", { name: /Sign and send offer/ }));
    expect(screen.getByText("Must be at least CAD 1,500.00.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("says it is not a legal contract", () => {
    render(<SendOfferForm projectId={4} proposedBudgetCents={200_000} api={fakeApi()} />);
    expect(screen.getByText(/not a legal contract/)).toBeInTheDocument();
  });
});
