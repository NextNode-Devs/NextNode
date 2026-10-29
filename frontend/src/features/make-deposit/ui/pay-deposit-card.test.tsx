import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CheckoutState } from "../api/start-deposit-checkout";
import { canPayDeposit } from "../model/can-pay-deposit";
import { PayDepositButton } from "./pay-deposit-button";
import { PayDepositCard } from "./pay-deposit-card";

vi.mock("../api/start-deposit-checkout", () => ({ startDepositCheckout: vi.fn() }));

const client = { isProjectClient: true, projectKind: "client", projectStatus: "Assigned" } as const;

function card(overrides: Partial<Parameters<typeof PayDepositCard>[0]> = {}) {
  return render(
    <PayDepositCard
      {...client}
      projectId="7"
      depositCents={200_000}
      offerTotalCents={1_000_000}
      depositPercent={20}
      currency="cad"
      {...overrides}
    />,
  );
}

describe("canPayDeposit", () => {
  it.each([
    [{}, true],
    [{ isProjectClient: false }, false],
    [{ projectKind: "developer" as const }, false],
    [{ projectStatus: "OfferSent" }, false],
    [{ projectStatus: "InProgress" }, false],
  ])("%o -> %s", (overrides, expected) => {
    expect(canPayDeposit({ ...client, ...overrides })).toBe(expected);
  });
});

describe("PayDepositCard", () => {
  it("shows the server-computed deposit in CAD with the test-mode note", () => {
    card();
    expect(screen.getByText("CAD 2,000.00")).toBeInTheDocument();
    expect(screen.getByText("20 % of the accepted offer (CAD 10,000.00)")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/no real money moves/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // the note is not announced as urgent
    expect(screen.getByRole("button", { name: "Pay deposit" })).toBeEnabled();
  });

  it("shows CAD 300.00 for a CAD 1,500.00 offer", () => {
    card({ depositCents: 30_000, offerTotalCents: 150_000 });
    expect(screen.getByText("CAD 300.00")).toBeInTheDocument();
  });

  it.each([{ isProjectClient: false }, { projectStatus: "Posted" }, { projectKind: "developer" as const }])(
    "renders nothing for %o",
    (overrides) => {
      const { container } = card(overrides);
      expect(container).toBeEmptyDOMElement();
    },
  );
});

describe("PayDepositButton", () => {
  it("disables itself while checkout opens, so a double click starts one checkout", async () => {
    let finish: (state: CheckoutState) => void = () => {};
    const action = vi.fn(() => new Promise<CheckoutState>((resolve) => (finish = resolve)));
    render(<PayDepositButton projectId="7" action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    const busy = await screen.findByRole("button", { name: "Opening Stripe Checkout…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("7");
    await act(async () => finish(null));
  });

  it("shows the server's refusal verbatim", async () => {
    const message = "Must be at least CAD 1,500.00; this is CAD 1,499.99.";
    const action = vi.fn(async () => ({ error: { code: "VALIDATION_ERROR", message } }));
    render(<PayDepositButton projectId="7" action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("explains a sign-in problem and offers a retry for a network failure", async () => {
    const action = vi
      .fn<(projectId: string) => Promise<CheckoutState>>()
      .mockResolvedValueOnce({
        error: { code: "UNAUTHENTICATED", message: "Authentication credentials were not provided." },
      })
      .mockResolvedValueOnce({ error: { code: "UNREACHABLE", message: "The API could not be reached." } });
    render(<PayDepositButton projectId="7" action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in as this project's client");

    fireEvent.click(screen.getByRole("button", { name: "Pay deposit" }));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("The API could not be reached.");
  });
});
