import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { HireDevsLink } from "./hire-devs-link";

const project = (viewer: Partial<Project["viewer"]>, team: Partial<Project["team"]> = {}) =>
  ({
    id: 4,
    team: { id: 1, status: "open", size: 5, headcount: 2, open_spots: 3, ...team },
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  }) as Project;

describe("HireDevsLink", () => {
  it("takes the Team Lead of a recruiting team to Hire Devs, marked as a prototype", () => {
    render(<HireDevsLink project={project({ is_lead: true })} />);
    expect(screen.getByRole("link", { name: "See matched developers" })).toHaveAttribute("href", "/projects/4/hire-devs");
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("is hidden from everyone else, and once the team is full or closed", () => {
    const { container, rerender } = render(<HireDevsLink project={project({ is_owner: true })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HireDevsLink project={project({ is_member: true })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HireDevsLink project={project({ is_lead: true }, { open_spots: 0 })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HireDevsLink project={project({ is_lead: true }, { status: "active" })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
