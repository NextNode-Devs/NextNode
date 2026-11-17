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
  it("shows the client the deposit, the final payment, the milestones, receipts and cancel", () => {
    renderAs("client");
    const totals = screen.getByRole("region", { name: "Payment totals" });
    expect(within(totals).getByText("Paid by you").nextSibling).toHaveTextContent("CAD 1,200.00");
    expect(within(totals).getByText("Still to pay").nextSibling).toHaveTextContent("CAD 4,800.00");
    expect(screen.getByText("Deposit (20 %)")).toBeInTheDocument();
    expect(screen.getByText(/Released to the team when you approve milestone 2/)).toBeInTheDocument();
    expect(screen.getByText("Final payment")).toBeInTheDocument();
    expect(screen.getByText("Paid when you approve the finished project.")).toBeInTheDocument();
    expect(screen.getAllByText("Releases the deposit")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /View receipt/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Cancel and request a refund" })).toBeInTheDocument();
  });

  it("gives the team the schedule only: no receipts, no cancel", () => {
    renderAs("team");
    expect(screen.getByText("Paid by the client")).toBeInTheDocument();
    expect(screen.getByText(/Released to the team when the client approves milestone 2/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Receipts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel and request a refund" })).not.toBeInTheDocument();
  });

  it("states the fees: no NextNode fee, refunds lose Stripe's processing fee", () => {
    renderAs("client");
    expect(screen.getByText("NextNode fee").nextSibling).toHaveTextContent("None");
    expect(screen.getByText("Refund fee").nextSibling).toHaveTextContent("Stripe's processing fee");
    expect(screen.getByText(/CAD 35.10 on your deposit/)).toBeInTheDocument();
  });

  it("opens a receipt and treats the download as under construction", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(screen.getByRole("button", { name: "View receipt NN-R-000101" }));
    const dialog = await screen.findByRole("dialog", { name: "Receipt NN-R-000101" });
    await user.click(within(dialog).getByRole("button", { name: "Download PDF" }));
    expect(getToasts()[0]?.description).toBe("Download receipt: this function is under construction.");
  });

  it("refund dialog shows the deposit minus Stripe's fee, then the prototype toast", async () => {
    const user = userEvent.setup();
    renderAs("client");
    await user.click(screen.getByRole("button", { name: "Cancel and request a refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleDescription(/You get CAD 1,164.90 back/);
    expect(within(dialog).getByText("−CAD 35.10")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Request refund" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getToasts()[0]?.description).toBe("Cancel and refund: this function is under construction.");
  });
});
