import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSampleOverview } from "../model/overview";
import { DashboardOverview } from "./dashboard-overview";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (feature: string) => underConstruction(feature) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const renderFor = (role: "developer" | "client") =>
  render(<DashboardOverview accountRole={role} result={loadSampleOverview(role)} />);
const projectList = () => screen.getByRole("list", { name: "Your projects" });
const rowOf = (title: string) => within(projectList()).getByText(title).closest("li")!;

describe("DashboardOverview", () => {
  beforeEach(() => underConstruction.mockClear());

  it("is marked as a prototype and says its data is sample data", () => {
    renderFor("developer");
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("sample data");
  });

  it("shows every project with the viewer's role and its latest update", () => {
    renderFor("developer");
    expect(within(projectList()).getAllByRole("listitem")).toHaveLength(5);
    expect(rowOf("Clinic booking app")).toHaveTextContent("Team Lead");
    expect(rowOf("Clinic booking app")).toHaveTextContent("Latest update: Milestone 2 is submitted for review.");
    expect(rowOf("Campus marketplace")).toHaveTextContent("Assistant Lead");
    expect(rowOf("Campus marketplace")).toHaveTextContent("No updates yet.");
    expect(rowOf("Food bank tracker")).toHaveTextContent("Developer");
  });

  it("shows a project the viewer left, with no way in and no update leaked", () => {
    renderFor("developer");
    const row = rowOf("Event ticketing");
    expect(row).toHaveTextContent("You're no longer on this team");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent("Latest update");
  });

  it("filters projects and needs attention by role, with the keyboard", async () => {
    const user = userEvent.setup();
    renderFor("developer");
    const attention = () => screen.getByRole("list", { name: "Needs attention" });
    expect(within(attention()).getAllByRole("listitem")).toHaveLength(3);

    await user.click(screen.getByRole("radio", { name: "All roles, 5 projects" }));
    await user.keyboard("{ArrowRight}"); // Team Lead
    await user.keyboard("{ArrowRight}"); // Assistant Lead
    expect(screen.getByRole("radio", { name: "Assistant Lead, 1 project" })).toBeChecked();
    expect(within(projectList()).getAllByRole("listitem")).toHaveLength(1);
    expect(within(attention()).getAllByRole("listitem")).toHaveLength(1);
    expect(attention()).toHaveTextContent("Is this project still active?");
  });

  it("says when nothing needs attention for a role", async () => {
    const user = userEvent.setup();
    renderFor("developer");
    await user.click(screen.getByRole("radio", { name: "Developer, 2 projects" }));
    expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument();
  });

  it("uses the under-construction toast for each action", async () => {
    const user = userEvent.setup();
    renderFor("developer");
    await user.click(screen.getByRole("button", { name: "Review applications: Clinic booking app" }));
    expect(underConstruction).toHaveBeenCalledWith("Review applications");
    await user.click(screen.getByRole("button", { name: "Open Clinic booking app" }));
    expect(underConstruction).toHaveBeenCalledWith("Open sample project");
  });

  it("gives a client no role filter, since they are always the Client", () => {
    renderFor("client");
    expect(screen.queryByRole("group", { name: "Show projects where I'm" })).not.toBeInTheDocument();
    expect(rowOf("Bakery ordering site")).toHaveTextContent("Client");
  });

  it("shows the error state when the overview can't load", () => {
    render(
      <DashboardOverview accountRole="developer" result={{ ok: false, error: { code: "UNAVAILABLE", message: "The server is down." } }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your dashboard overview");
    expect(screen.getByRole("alert")).toHaveTextContent("The server is down.");
    expect(screen.queryByRole("list", { name: "Your projects" })).not.toBeInTheDocument();
  });
});
