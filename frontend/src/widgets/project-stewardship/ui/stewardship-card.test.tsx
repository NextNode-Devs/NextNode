import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Stewardship } from "@/entities/team";

import { StewardshipCard } from "./stewardship-card";

vi.mock("@/features/choose-assistant-lead", () => ({ ChooseAssistantLead: () => <p>choose form</p> }));
vi.mock("@/features/close-developer-project", () => ({ CloseProjectButton: () => <button>Close project</button> }));
vi.mock("@/features/confirm-project-active", () => ({
  ActivityCheckAlert: ({ canConfirm }: { canConfirm: boolean }) => (
    <div role="alert">Is this project still active? {canConfirm ? "can answer" : "cannot answer"}</div>
  ),
}));
vi.mock("@/shared/ui/refresh-button", () => ({ RefreshButton: () => <button>Try again</button> }));

const stewardship = (overrides: Partial<Stewardship> = {}): Stewardship => ({
  project_id: 4,
  project_status: "InProgress",
  assistant_lead: null,
  assistant_lead_can: [
    { label: "Mark the project closed", available: true },
    { label: "Add members", available: false },
  ],
  assistant_lead_cannot: ["Remove the Team Lead"],
  lead_last_active_at: "2026-11-01T14:00:00Z",
  activity_check_due_at: "2026-12-01T14:00:00Z",
  activity_check: null,
  hidden_from_feed: false,
  members: [{ account_id: 7, display_name: "Linus" }],
  actions: { choose_assistant_lead: false, confirm_active: false, close_project: false },
  ...overrides,
});

const CHECK = {
  question: "Is this project still active?",
  started_at: "2026-12-01T14:00:00Z",
  answer_by: "2026-12-08T14:00:00Z",
  answered_by: null,
};

describe("StewardshipCard", () => {
  it("lists what an Assistant Lead may do, marking what isn't built yet as planned", () => {
    render(<StewardshipCard projectId={4} isLead={false} stewardship={stewardship()} loadError={null} />);
    expect(screen.getByRole("heading", { name: "No Assistant Lead yet" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).queryByText("Planned")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Remove the Team Lead")).toBeInTheDocument();
    expect(screen.getByText(/If they don't write again by/)).toBeInTheDocument();
    expect(screen.queryByText("choose form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close project" })).not.toBeInTheDocument();
  });

  it("names the Assistant Lead and shows the Lead's controls", () => {
    const data = stewardship({
      assistant_lead: { account_id: 7, display_name: "Linus" },
      actions: { choose_assistant_lead: true, confirm_active: false, close_project: true },
    });
    render(<StewardshipCard projectId={4} isLead stewardship={data} loadError={null} />);
    expect(screen.getByRole("heading", { name: "Assistant Lead: Linus" })).toBeInTheDocument();
    expect(screen.getByText("choose form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close project" })).toBeInTheDocument();
  });

  it("asks the members while a check is pending", () => {
    const data = stewardship({
      activity_check: { ...CHECK, status: "pending", ended_at: null },
      hidden_from_feed: true,
      actions: { choose_assistant_lead: false, confirm_active: true, close_project: false },
    });
    render(<StewardshipCard projectId={4} isLead={false} stewardship={data} loadError={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Is this project still active? can answer");
    expect(screen.getByText(/members are being asked/)).toBeInTheDocument();
  });

  it("says how the last check ended, and when the project is closed", () => {
    const data = stewardship({
      project_status: "Closed",
      activity_check: { ...CHECK, status: "closed", ended_at: "2026-12-08T14:00:00Z" },
    });
    render(<StewardshipCard projectId={4} isLead={false} stewardship={data} loadError={null} />);
    expect(screen.getByText("This project is closed.")).toBeInTheDocument();
    expect(screen.getByText(/Nobody confirmed in time/)).toBeInTheDocument();
  });

  it("shows a retry when it couldn't load", () => {
    render(<StewardshipCard projectId={4} isLead={false} stewardship={null} loadError="Network down." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
