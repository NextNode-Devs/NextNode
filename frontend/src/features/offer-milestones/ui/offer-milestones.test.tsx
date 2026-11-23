import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleMilestoneDraft } from "@/entities/milestone";
import { underConstruction } from "@/shared/lib/toast";

import { AcceptMilestones } from "./accept-milestones";
import { MilestonePlanForm } from "./milestone-plan-form";

vi.mock("@/shared/lib/toast", () => ({ underConstruction: vi.fn() }));

const TOTAL = 600_000;

describe("MilestonePlanForm (Team Lead)", () => {
  beforeEach(() => vi.mocked(underConstruction).mockClear());

  it("shows the role, starts with three milestones that add up, and keeps at least three", () => {
    render(<MilestonePlanForm projectTitle="Booking app" offerTotalCents={TOTAL} initialRows={sampleMilestoneDraft(TOTAL)} />);
    expect(screen.getByText(/sending this as the/)).toHaveTextContent("Team Lead of Booking app");
    const list = screen.getByRole("list", { name: "Milestones" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Remove milestone 1" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("CAD 6,000.00 of the CAD 6,000.00 offer total.");
  });

  it("refuses amounts that don't add up and sends nothing", async () => {
    const user = userEvent.setup();
    render(<MilestonePlanForm projectTitle="Booking app" offerTotalCents={TOTAL} initialRows={sampleMilestoneDraft(TOTAL)} />);
    const amount = screen.getAllByLabelText(/^Amount/)[0];
    await user.clear(amount);
    await user.type(amount, "1000");
    expect(screen.getByRole("status")).toHaveTextContent("CAD 800.00 left");
    await user.click(screen.getByRole("button", { name: "Send milestones with the offer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The milestone amounts must add up to the offer total.");
    expect(underConstruction).not.toHaveBeenCalled();
  });

  it("adds a milestone that can then be removed, offers higher deposits, and sends a valid plan", async () => {
    const user = userEvent.setup();
    render(<MilestonePlanForm projectTitle="Booking app" offerTotalCents={TOTAL} initialRows={sampleMilestoneDraft(TOTAL)} />);
    await user.click(screen.getByRole("button", { name: "Add a milestone" }));
    expect(screen.getByRole("button", { name: "Remove milestone 4" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Remove milestone 4" }));
    await user.selectOptions(screen.getByLabelText("Deposit"), "30");
    expect(screen.getByLabelText("Deposit")).toHaveDisplayValue("30 % (CAD 1,800.00)");
    await user.click(screen.getByRole("button", { name: "Send milestones with the offer" }));
    expect(underConstruction).toHaveBeenCalledWith("Sending the milestones with your offer");
  });
});

const MILESTONES = [
  { sequence: 1, title: "Designs", amount_cents: 180_000, due_date: "2027-01-15" },
  { sequence: 2, title: "Core features", amount_cents: 240_000, due_date: "2027-02-12" },
  { sequence: 3, title: "Launch", amount_cents: 180_000, due_date: "2027-03-05" },
];

describe("AcceptMilestones (client)", () => {
  beforeEach(() => vi.mocked(underConstruction).mockClear());

  it("shows the role, every milestone and the deposit, and only offers milestone 1 or 2", () => {
    render(<AcceptMilestones projectTitle="Booking app" offerTotalCents={TOTAL} depositPercent={20} milestones={MILESTONES} />);
    expect(screen.getByText(/accepting as the/)).toHaveTextContent("client of Booking app");
    expect(screen.getByText(/Deposit:/)).toHaveTextContent("CAD 1,200.00");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Milestone 1: Designs" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Launch/ })).not.toBeInTheDocument();
  });

  it("explains the deposit without mentioning proof of work", async () => {
    const user = userEvent.setup();
    render(<AcceptMilestones projectTitle="Booking app" offerTotalCents={TOTAL} depositPercent={20} milestones={MILESTONES} />);
    await user.click(screen.getByRole("button", { name: "When is the deposit released?" }));
    const tip = await screen.findByText(/held until you approve the milestone you choose/);
    expect(tip).toHaveTextContent("refunded minus Stripe's processing fee");
    expect(document.body).not.toHaveTextContent(/proof/i);
  });

  it("asks for the release milestone before accepting, then accepts all milestones together", async () => {
    const user = userEvent.setup();
    render(<AcceptMilestones projectTitle="Booking app" offerTotalCents={TOTAL} depositPercent={20} milestones={MILESTONES} />);
    await user.click(screen.getByRole("button", { name: "Accept all 3 milestones" }));
    expect(screen.getByText("Choose milestone 1 or 2.")).toBeInTheDocument();
    expect(underConstruction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Milestone 2: Core features" }));
    await user.click(screen.getByRole("button", { name: "Accept all 3 milestones" }));
    expect(underConstruction).toHaveBeenCalledWith("Accepting the offer's milestones");
  });
});
