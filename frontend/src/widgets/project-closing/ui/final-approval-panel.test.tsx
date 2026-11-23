import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { getToasts, resetToasts } from "@/shared/lib/toast";

import { FinalApprovalPanel } from "./final-approval-panel";

afterEach(() => act(() => resetToasts()));

describe("FinalApprovalPanel", () => {
  it("lets the client approve and pay; it says it's under construction and links to the archived view", async () => {
    const user = userEvent.setup();
    render(<FinalApprovalPanel projectId={12} viewer="client" />);
    expect(screen.getByText("4 of 4 approved")).toBeInTheDocument();
    expect(screen.getByText("CAD 4,800.00")).toBeInTheDocument();
    expect(screen.getAllByText("To be defined").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Give final approval" }));
    const dialog = await screen.findByRole("dialog", { name: "Give final approval?" });
    await user.click(within(dialog).getByRole("button", { name: "Approve and pay CAD 4,800.00" }));

    expect(getToasts().at(-1)?.description).toBe("Final approval and final payment: this function is under construction.");
    expect(screen.getByText("Preview only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the archived project" })).toHaveAttribute("href", "/projects/12/archived");
    expect(screen.queryByRole("button", { name: "Give final approval" })).not.toBeInTheDocument();
  });

  it("shows the Team Lead and members where it stands, with no approval button", () => {
    render(<FinalApprovalPanel projectId={12} viewer="lead" />);
    expect(screen.queryByRole("button", { name: "Give final approval" })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for the client's final approval/)).toBeInTheDocument();
  });

  it("waits while milestones are open", () => {
    render(<FinalApprovalPanel projectId={12} viewer="client" initial="milestones_open" />);
    expect(screen.getByText("Final approval opens when every milestone is approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Give final approval" })).not.toBeInTheDocument();
  });

  it("keeps a confidential project off portfolios", async () => {
    const user = userEvent.setup();
    render(<FinalApprovalPanel projectId={12} viewer="client" />);
    expect(screen.getByText(/listed under "Shipped projects"/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Sample: confidential project" }));
    expect(screen.getByText(/kept off every portfolio/)).toBeInTheDocument();
    expect(screen.getByText("Kept out of the team's portfolios")).toBeInTheDocument();
  });
});
