import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_MILESTONE_PLAN } from "@/entities/milestone";
import { SAMPLE_PLANNED_PAYMENTS } from "@/entities/payment";
import { getToasts, resetToasts } from "@/shared/lib/toast";

import { MilestonePayments } from "./milestone-payments";

// The payment entity's index also exports a server-only API call.
vi.mock("server-only", () => ({}));

afterEach(() => act(() => resetToasts()));

function renderAs(viewer: "client" | "team") {
  return render(<MilestonePayments viewer={viewer} plan={SAMPLE_MILESTONE_PLAN} payments={SAMPLE_PLANNED_PAYMENTS} />);
}

describe("MilestonePayments", () => {
  it("shows the client totals, the schedule, receipts and the cancel action", () => {
    renderAs("client");
    const totals = screen.getByRole("region", { name: "Payment totals" });
    expect(within(totals).getByText("Paid by you").nextSibling).toHaveTextContent("CAD 4,000.00");
    expect(within(totals).getByText("Held (refundable)").nextSibling).toHaveTextContent("CAD 2,800.00");
    expect(screen.getByRole("heading", { name: "Payment schedule" })).toBeInTheDocument();
    // The deposit and milestone 2 are both released when milestone 2 is approved.
    expect(screen.getAllByText(/Released when you approve milestone 2/)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /View receipt/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Cancel and request a refund" })).toBeInTheDocument();
  });

  it("gives the team the schedule only: no receipts, no cancel", () => {
    renderAs("team");
    expect(screen.getByText("Paid by the client")).toBeInTheDocument();
    expect(screen.getAllByText(/Released when the client approves milestone/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Receipts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel and request a refund" })).not.toBeInTheDocument();
  });

  it("states there are no hidden fees", () => {
    renderAs("client");
    expect(screen.getByText("NextNode fee").nextSibling).toHaveTextContent("None");
    expect(screen.getByText("Refund fee").nextSibling).toHaveTextContent("None");
  });

  it("opens a receipt and treats the download as under construction", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(screen.getByRole("button", { name: "View receipt NN-R-000101" }));
    const dialog = await screen.findByRole("dialog", { name: "Receipt NN-R-000101" });
    await user.click(within(dialog).getByRole("button", { name: "Download PDF" }));
    expect(getToasts()[0]?.description).toBe("Download receipt: this function is under construction.");
  });

  it("refund dialog lists what is refunded and what is not, then shows the prototype toast", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleDescription(/refunded in full, with no fee: CAD 2,800.00/);
    expect(within(dialog).getByText(/Not refunded/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Request refund" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getToasts()[0]?.description).toBe("Cancel and refund: this function is under construction.");
  });
});
