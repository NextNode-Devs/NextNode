import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { sampleInviteLinkByToken } from "@/entities/invite-link";
import type { Project } from "@/entities/project";

import type { InviteScreenState } from "../model/screen-state";
import { InviteScreen } from "./invite-screen";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (feature: string) => underConstruction(feature) }));

const NOW = "2026-11-23T17:00:00.000Z";
const project = {
  id: 4,
  title: "Food bank tracker",
  tech_stack: [{ key: "react", label: "React" }],
  owner: { account_id: 1, display_name: "Client Co" },
  lead: { account_id: 2, display_name: "Lee Lead" },
  team: { id: 1, status: "open", size: 5, headcount: 2, open_spots: 3 },
  viewer: { is_owner: false, is_lead: false, is_member: false },
} as Project;

const show = (state: InviteScreenState, status: "active" | "expired" | "used" = "active") =>
  render(<InviteScreen state={state} link={sampleInviteLinkByToken(`nn-4-${status}`, NOW)} project={project} now={NOW} />);

describe("InviteScreen", () => {
  it("invites a developer to the project, with the expiry, and joining under construction", async () => {
    const user = userEvent.setup();
    show("ready");
    expect(screen.getByRole("heading", { level: 1, name: "Food bank tracker" })).toBeInTheDocument();
    expect(screen.getByText("Lee Lead invited you to join their team")).toBeInTheDocument();
    expect(screen.getByText("3 open spots on a team of 5")).toBeInTheDocument();
    expect(screen.getByText("This link expires in 2 days, on Nov 25, 12:00 p.m. ET.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join the team" }));
    expect(underConstruction).toHaveBeenCalledWith("Join with invite link");
    expect(screen.getByRole("link", { name: "View the project" })).toHaveAttribute("href", "/projects/4");
  });

  it("explains an expired link and who to ask for a new one", () => {
    show("expired", "expired");
    expect(screen.getByRole("heading", { level: 1, name: "This invite link has expired" })).toBeInTheDocument();
    expect(screen.getByText(/stopped working on Nov 16, 12:00 p\.m\. ET.*ask Lee Lead for a new one/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join the team" })).not.toBeInTheDocument();
  });

  it("explains a used link: each one lets one developer join", () => {
    show("used", "used");
    expect(screen.getByRole("heading", { level: 1, name: "This invite link has already been used" })).toBeInTheDocument();
    expect(screen.getByText(/lets one developer join/)).toBeInTheDocument();
  });

  it("says an unknown link isn't valid", () => {
    render(<InviteScreen state="invalid" link={null} project={null} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "This invite link isn't valid" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse projects" })).toHaveAttribute("href", "/projects");
  });

  it("denies clients and people already on the project, and explains a full team", () => {
    const { unmount } = show("client");
    expect(screen.getByRole("heading", { name: "Only developers can join a team" })).toBeInTheDocument();
    unmount();
    const second = show("on-team");
    expect(screen.getByRole("heading", { name: "You're already part of Food bank tracker" })).toBeInTheDocument();
    second.unmount();
    show("full");
    expect(screen.getByRole("heading", { name: "This team isn't taking new members" })).toBeInTheDocument();
  });
});
