import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";

import { WorkspaceHelpCard } from "./workspace-help-card";

type Viewer = Partial<Project["viewer"]>;

function project(viewer: Viewer, lead: Project["lead"] = { account_id: 2, display_name: "Sam Lee" }): Project {
  return {
    lead,
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  } as Project;
}

const RAISE = { name: "Raise an issue with your Team Lead" };
const SUPPORT = { name: "Contact support" };

describe("WorkspaceHelpCard", () => {
  it("offers a member both routes, Team Lead first", () => {
    render(<WorkspaceHelpCard project={project({ is_member: true })} />);
    expect(screen.getByRole("region", { name: "Something not right?" })).toHaveTextContent("Prototype");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Raise an issue with your Team Lead", "Contact support"]);
  });

  it("offers only support to a member when the project has no Team Lead", () => {
    render(<WorkspaceHelpCard project={project({ is_member: true }, null)} />);
    expect(screen.queryByRole("button", RAISE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", SUPPORT)).toBeInTheDocument();
    expect(screen.getByText(/no Team Lead right now/)).toBeInTheDocument();
  });

  it("tells the Team Lead issues come to them and offers support", () => {
    render(<WorkspaceHelpCard project={project({ is_lead: true, is_member: true })} />);
    expect(screen.queryByRole("button", RAISE)).not.toBeInTheDocument();
    expect(screen.getByText(/Team members raise issues with you/)).toBeInTheDocument();
    expect(screen.getByRole("button", SUPPORT)).toBeInTheDocument();
  });

  it("offers the client support", () => {
    render(<WorkspaceHelpCard project={project({ is_owner: true })} />);
    expect(screen.queryByRole("button", RAISE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", SUPPORT)).toBeInTheDocument();
  });

  it("renders nothing for someone outside the project", () => {
    const { container } = render(<WorkspaceHelpCard project={project({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});
