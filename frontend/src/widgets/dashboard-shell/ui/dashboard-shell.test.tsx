import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/entities/viewer";

import { DashboardShell } from "./dashboard-shell";

vi.mock("@/entities/viewer", () => ({ ROLE_LABEL: { developer: "Developer", client: "Client" } }));

const developer: Account = {
  id: 1,
  role: "developer",
  display_name: "Ada",
  created_at: null,
  profile: { headline: "Dev", bio: "", github_username: null, skills: [] },
};
const client: Account = {
  id: 2,
  role: "client",
  display_name: "Grace",
  created_at: null,
  profile: { company_name: "Acme", industry: "Retail" },
};

function sectionTitles() {
  return screen.getAllByRole("region").map((region) => within(region).getByRole("heading").textContent);
}

describe("DashboardShell", () => {
  it("gives developers invitations, applications, projects and conversations", () => {
    render(<DashboardShell account={developer} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome, Ada");
    expect(sectionTitles()).toEqual(["Invitations", "Applications", "My projects", "Conversations"]);
  });

  it("gives clients no invitations section", () => {
    render(<DashboardShell account={client} />);
    expect(sectionTitles()).toEqual(["My projects", "Applications", "Conversations"]);
    expect(screen.getByRole("navigation", { name: "Dashboard sections" })).not.toHaveTextContent("Invitations");
  });

  it("says what will appear in each empty section, and lets later issues fill a slot", () => {
    render(<DashboardShell account={client} sections={{ "my-projects": <p>Inventory app</p> }} />);
    const projects = screen.getByRole("region", { name: "My projects" });
    expect(projects).toHaveTextContent("Inventory app");
    const conversations = screen.getByRole("region", { name: "Conversations" });
    expect(conversations).toHaveTextContent("Conversations with Team Lead candidates will appear here");
  });
});
