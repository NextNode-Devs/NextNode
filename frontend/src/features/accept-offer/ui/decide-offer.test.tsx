import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Offer } from "@/entities/start-gate";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { DecideOffer } from "./decide-offer";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));

const offer = { id: 9, version: 2, status: "sent" } as Offer;
const fakeApi = (result: ApiResult<unknown> = { ok: true, data: {} }) =>
  ({ post: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => refresh.mockClear());

describe("DecideOffer", () => {
  it("accepts the open version and says what comes next", async () => {
    const api = fakeApi();
    render(<DecideOffer offer={offer} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Accept version 2" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/offers/9/accept/"));
    expect(await screen.findByRole("status")).toHaveTextContent("pay the deposit");
    expect(refresh).toHaveBeenCalled();
  });

  it("needs a reason to decline, then sends it", async () => {
    const api = fakeApi();
    render(<DecideOffer offer={offer} api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Decline…" }));
    await user.click(screen.getByRole("button", { name: "Decline version 2" }));
    expect(screen.getByText("Say why you're declining.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Why are you declining/), "Above our budget");
    await user.click(screen.getByRole("button", { name: "Decline version 2" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/offers/9/decline/", { reason: "Above our budget" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("revised offer");
  });

  it("shows the server's refusal", async () => {
    const api = fakeApi({
      ok: false,
      error: { code: "FORBIDDEN", message: "Only the project's client can accept or decline the offer." },
    });
    render(<DecideOffer offer={offer} api={api} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Accept version 2" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the project's client");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says it is an acknowledgement, not a legal contract", () => {
    render(<DecideOffer offer={offer} api={fakeApi()} />);
    expect(screen.getByText(/not a legal contract/)).toBeInTheDocument();
  });
});
