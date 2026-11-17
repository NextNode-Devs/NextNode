import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RequestRefundButton, type RefundLine } from "./request-refund-button";

const deposit: RefundLine = { id: 1, label: "Deposit", amount_cents: 120_000, fee_cents: 3_510, refund_cents: 116_490 };

describe("RequestRefundButton", () => {
  it("cannot confirm once the deposit has been released", async () => {
    const user = userEvent.setup();
    render(<RequestRefundButton lines={[]} />);
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleDescription(
      "Your deposit has already been released to the team, so there is nothing to refund.",
    );
    expect(screen.getByRole("button", { name: "Request refund" })).toBeDisabled();
  });

  it("shows the amount, Stripe's fee and what comes back", async () => {
    const user = userEvent.setup();
    render(<RequestRefundButton lines={[deposit]} />);
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    expect(await screen.findByText("Stripe processing fee (not refunded)")).toBeInTheDocument();
    expect(screen.getByText("You get back").nextSibling).toHaveTextContent("CAD 1,164.90");
  });

  it("closes without doing anything from Keep the project, returning focus", async () => {
    const user = userEvent.setup();
    render(<RequestRefundButton lines={[deposit]} />);
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    await user.click(await screen.findByRole("button", { name: "Keep the project" }));
    expect(await screen.findByRole("button", { name: "Cancel and request a refund" })).toHaveFocus();
  });
});
