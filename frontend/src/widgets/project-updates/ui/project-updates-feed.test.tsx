import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SAMPLE_MILESTONES } from "@/entities/milestone";
import { SAMPLE_PROJECT_UPDATES } from "@/entities/project-update";

import { ProjectUpdatesFeed } from "./project-updates-feed";

vi.mock("@/features/post-project-update", () => ({ PostUpdateForm: () => <p>post form</p> }));

describe("ProjectUpdatesFeed", () => {
  it("groups posts under their milestone, latest milestone first, with its status", () => {
    render(<ProjectUpdatesFeed updates={SAMPLE_PROJECT_UPDATES} milestones={SAMPLE_MILESTONES} chatHref="/projects/4/chat" />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.slice(0, 2)).toEqual(["Milestone 2 · Accounts and booking flow", "Milestone 1 · Designs and project setup"]);

    const latest = screen.getByRole("region", { name: /Milestone 2/ });
    expect(within(latest).getByText("Under review")).toBeInTheDocument();
    expect(within(latest).getAllByRole("listitem")).toHaveLength(2);
  });

  it("folds older groups behind 'Show earlier updates'", () => {
    render(<ProjectUpdatesFeed updates={SAMPLE_PROJECT_UPDATES} milestones={SAMPLE_MILESTONES} chatHref={null} />);
    expect(screen.getByText("Show 1 earlier update")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Before work started", hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
  });

  it("points the team to Chat for back-and-forth", () => {
    render(<ProjectUpdatesFeed updates={[]} milestones={[]} chatHref="/projects/4/chat" />);
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/projects/4/chat");
    expect(screen.getByText("No updates yet")).toBeInTheDocument();
  });
});
