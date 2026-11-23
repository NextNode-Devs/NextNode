import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { FinishLink } from "./finish-link";

const project = (viewer: Partial<Project["viewer"]>, kind: Project["kind"] = "client") =>
  ({ id: 4, kind, viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer } }) as Project;

describe("FinishLink", () => {
  it("takes the client, the Team Lead and members to final approval and the archived view", () => {
    for (const viewer of [{ is_owner: true }, { is_lead: true }, { is_member: true }]) {
      const { unmount } = render(<FinishLink project={project(viewer)} />);
      expect(screen.getByRole("link", { name: "Final approval" })).toHaveAttribute("href", "/projects/4/final-approval");
      expect(screen.getByRole("link", { name: "Archived view" })).toHaveAttribute("href", "/projects/4/archived");
      expect(screen.getByText("Prototype")).toBeInTheDocument();
      unmount();
    }
  });

  it("is hidden from outsiders and on developer projects", () => {
    const { container, rerender } = render(<FinishLink project={project({})} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FinishLink project={project({ is_lead: true }, "developer")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
