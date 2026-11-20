import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { ProjectTabs } from "./project-tabs";

const project = (viewer: Partial<Project["viewer"]>) =>
  ({
    id: 4,
    kind: "client",
    viewer: { is_owner: false, is_lead: false, is_member: false, can_read_documents: false, ...viewer },
  }) as Project;

describe("ProjectTabs", () => {
  it("marks the current tab in words and style", () => {
    render(<ProjectTabs project={project({ is_member: true })} current="updates" />);
    const nav = screen.getByRole("navigation", { name: "Project sections" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Updates" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("renders nothing for someone outside the project", () => {
    const { container } = render(<ProjectTabs project={project({})} current="overview" />);
    expect(container).toBeEmptyDOMElement();
  });
});
