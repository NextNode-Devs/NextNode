import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { InviteLinkSection } from "./invite-link-section";

const NOW = "2026-11-23T17:00:00.000Z";
const project = (viewer: Partial<Project["viewer"]>, team: Partial<Project["team"]> = {}) =>
  ({
    id: 4,
    team: { id: 1, status: "open", size: 5, headcount: 2, open_spots: 3, ...team },
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  }) as Project;

describe("InviteLinkSection", () => {
  it("gives the Team Lead of a recruiting team their invite link", () => {
    render(<InviteLinkSection project={project({ is_lead: true })} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Invite by link" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Current link" })).toHaveValue(`${window.location.origin}/invite/nn-4-active`);
  });

  it("is hidden from everyone else, and once the team is full or closed", () => {
    const { container, rerender } = render(<InviteLinkSection project={project({ is_owner: true })} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InviteLinkSection project={project({ is_member: true })} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InviteLinkSection project={project({ is_lead: true }, { open_spots: 0 })} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InviteLinkSection project={project({ is_lead: true }, { status: "active" })} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });
});
