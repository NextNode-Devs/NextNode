import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SAMPLE_PLANNED_PAYMENTS, type PlannedPayment } from "@/entities/payment";

import { RequestRefundButton } from "./request-refund-button";

// The payment entity's index also exports a server-only API call.
vi.mock("server-only", () => ({}));

const held = SAMPLE_PLANNED_PAYMENTS.filter((item) => item.state === "held");
const released = SAMPLE_PLANNED_PAYMENTS.filter((item) => item.state === "released");

describe("RequestRefundButton", () => {
  it("cannot confirm when nothing is held", async () => {
    const user = userEvent.setup();
    const nothingHeld: PlannedPayment[] = [];
    render(<RequestRefundButton refundable={nothingHeld} released={released} />);
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleDescription("Nothing is held right now, so there is nothing to refund.");
    expect(screen.getByRole("button", { name: "Request refund" })).toBeDisabled();
  });

  it("closes without doing anything from Keep the project", async () => {
    const user = userEvent.setup();
    render(<RequestRefundButton refundable={held} released={released} />);
    const trigger = screen.getByRole("button", { name: "Cancel and request a refund" });
    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Keep the project" }));
    expect(await screen.findByRole("button", { name: "Cancel and request a refund" })).toHaveFocus();
  });
});
