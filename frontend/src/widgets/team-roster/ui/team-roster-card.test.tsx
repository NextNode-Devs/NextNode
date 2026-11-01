import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/entities/project";
import type { TeamProfile } from "@/entities/team";

import { TeamRosterCard } from "./team-roster-card";

vi.mock("@/features/set-team-size", () => ({
  SetTeamSize: ({ size }: { size: number | null }) => <p>set size from {String(size)}</p>,
}));

const viewer = (overrides: Partial<Project["viewer"]> = {}): Project["viewer"] => ({
  is_owner: false,
  is_lead: false,
  is_member: false,
  can_edit: false,
  can_upload_documents: false,
  can_read_documents: false,
  ...overrides,
});

const project = (overrides: Partial<Project> = {}) => ({ id: 4, viewer: viewer(), ...overrides }) as Project;

const LEAD = {
  account_id: 1,
  display_name: "Ada",
  role: "lead" as const,
  joined_at: "2026-10-30T14:42:00Z",
  portfolio_url: "/developers/1",
};
const MEMBER = { ...LEAD, account_id: 2, display_name: "Linus", role: "member" as const, portfolio_url: "/developers/2" };

const team = (overrides: Partial<TeamProfile> = {}): TeamProfile => ({
  size: 5,
  open_spots: 3,
  status: "open",
  members: [LEAD, MEMBER],
  ...overrides,
});

describe("TeamRosterCard", () => {
  it("shows the Team Lead first, with portfolio links and the open spots", () => {
    render(<TeamRosterCard project={project()} team={team()} loadError={null} />);
    const links = within(screen.getByRole("list", { name: "Team members" })).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Ada", "/developers/1"],
      ["Linus", "/developers/2"],
    ]);
    expect(screen.getByText("Team Lead:")).toBeInTheDocument();
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 5 people · 3 open spots")).toBeInTheDocument();
  });

  it("says when a client project still needs its Team Lead", () => {
    render(
      <TeamRosterCard
        project={project()}
        team={team({ size: null, open_spots: 0, members: [] })}
        loadError={null}
      />,
    );
    expect(screen.getByText("Looking for a Team Lead.")).toBeInTheDocument();
    expect(screen.getByText(/Teams have 5 to 7 people, Team Lead included/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Team members" })).not.toBeInTheDocument();
  });

  it("says when the team is full, or recruitment has closed", () => {
    const { unmount } = render(<TeamRosterCard project={project()} team={team({ open_spots: 0 })} loadError={null} />);
    expect(screen.getByText(/The team is full/)).toBeInTheDocument();
    unmount();
    render(<TeamRosterCard project={project()} team={team({ open_spots: 0, status: "locked" })} loadError={null} />);
    expect(screen.getByText(/Recruitment has closed/)).toBeInTheDocument();
  });

  it("gives only the Team Lead the size control, while recruiting", () => {
    const lead = project({ viewer: viewer({ is_lead: true }) });
    const { unmount } = render(<TeamRosterCard project={lead} team={team()} loadError={null} />);
    expect(screen.getByText("set size from 5")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find developers to invite" })).toHaveAttribute("href", "/developers");
    unmount();

    const { unmount: gone } = render(<TeamRosterCard project={lead} team={team({ status: "locked" })} loadError={null} />);
    expect(screen.queryByText(/set size/)).not.toBeInTheDocument();
    gone();

    render(<TeamRosterCard project={project()} team={team()} loadError={null} />);
    expect(screen.queryByText(/set size/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Find developers to invite" })).not.toBeInTheDocument();
  });

  it("says when the team can't be loaded", () => {
    render(<TeamRosterCard project={project()} team={null} loadError="The API could not be reached." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The API could not be reached.");
  });
});
