import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Deposit } from "@/entities/payment";

import { POLL_MS, STILL_WAITING_AFTER_MS } from "./confirming-payment";
import { DepositResultCard } from "./deposit-result-card";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/make-deposit/api/start-deposit-checkout", () => ({ startDepositCheckout: vi.fn() }));

function deposit(status: Deposit["status"]): Deposit {
  return {
    status,
    amount_cents: status === "none" ? null : 200_000,
    currency: status === "none" ? null : "cad",
    completed_at: status === "completed" ? "2026-10-29T12:00:00Z" : null,
  };
}

function show(mode: "return" | "cancelled", status: Deposit["status"]) {
  render(<DepositResultCard mode={mode} projectId="7" outcome={{ state: "ready", deposit: deposit(status) }} />);
}

describe("return page", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    refresh.mockClear();
  });

  it("shows confirmed only when the server reports the deposit completed", () => {
    show("return", "completed");
    expect(screen.getByRole("heading", { name: /deposit confirmed/i })).toBeInTheDocument();
    expect(screen.getByText(/stripe confirmed cad 2,000\.00/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the project" })).toHaveAttribute("href", "/projects/7");
  });

  it("keeps confirming while pending, polls the server, then says it is still waiting", () => {
    show("return", "pending");
    expect(screen.getByRole("status")).toHaveTextContent("Confirming payment…");
    expect(screen.queryByText(/deposit confirmed/i)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(POLL_MS * 2));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/still waiting/i)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(STILL_WAITING_AFTER_MS));
    expect(screen.getByText(/still waiting for stripe to confirm/i)).toHaveTextContent(
      "nothing has been charged twice",
    );
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Confirming payment…");
  });

  it("offers a retry when the payment failed", () => {
    show("return", "failed");
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("does not poll when there is no checkout", () => {
    show("return", "none");
    act(() => vi.advanceTimersByTime(POLL_MS * 3));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /no deposit checkout yet/i })).toBeInTheDocument();
  });
});

describe("cancelled page", () => {
  it("says nothing was charged and offers a retry", () => {
    show("cancelled", "pending");
    expect(screen.getByRole("heading", { name: "Checkout cancelled" })).toBeInTheDocument();
    expect(screen.getByText(/nothing was charged/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows the confirmed state if the deposit was in fact paid", () => {
    show("cancelled", "completed");
    expect(screen.getByRole("heading", { name: /deposit confirmed/i })).toBeInTheDocument();
  });
});

describe("errors", () => {
  function fail(code: string, message = "x") {
    render(
      <DepositResultCard mode="return" projectId="7" outcome={{ state: "error", error: { code, message } }} />,
    );
  }

  it.each(["FORBIDDEN", "NOT_FOUND"])("%s renders permission denied, with no payment controls", (code) => {
    fail(code);
    expect(screen.getByRole("heading", { name: "You can't view this payment" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks a signed-out visitor to sign in", () => {
    fail("UNAUTHENTICATED");
    expect(screen.getByRole("heading", { name: /sign in to see this payment/i })).toBeInTheDocument();
  });

  it("shows a network failure with a retry", () => {
    fail("UNREACHABLE", "The API could not be reached.");
    expect(screen.getByRole("alert")).toHaveTextContent("The API could not be reached.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("announces loading", () => {
    render(<DepositResultCard mode="return" projectId="7" outcome={{ state: "loading" }} />);
    expect(screen.getByRole("status", { name: "Checking your deposit" })).toBeInTheDocument();
  });
});
