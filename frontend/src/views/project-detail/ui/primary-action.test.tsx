import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/entities/project";

import { PrimaryAction } from "./primary-action";

vi.mock("@/features/apply-to-lead", () => ({
  ApplyToLead: ({ projectId }: { projectId: number }) => <button>Apply to lead {projectId}</button>,
}));

const project = (overrides: Partial<Project>): Project => ({
  id: 5,
  kind: "client",
  status: "Posted",
  title: "Booking app",
  description: "A booking app for a small yoga studio.",
  tech_stack: [],
  target_delivery_date: "2027-02-01",
  proposed_budget_cents: 250_000,
  owner: { account_id: 1, display_name: "Grace" },
  lead: null,
  team: { id: 1, status: "open", size: null, headcount: 0, open_spots: 0 },
  viewer: {
    is_owner: false,
    is_lead: false,
    is_member: false,
    can_edit: false,
    can_upload_documents: false,
    can_read_documents: false,
  },
  viewer_actions: [],
  created_at: null,
  ...overrides,
});

describe("PrimaryAction", () => {
  it("offers Apply to lead when the API says it applies", () => {
    render(<PrimaryAction project={project({ viewer_actions: ["apply_to_lead"] })} />);
    expect(screen.getByRole("button", { name: "Apply to lead 5" })).toBeInTheDocument();
  });

  it("offers nothing on a developer idea, whose actions never include leading", () => {
    const { container } = render(<PrimaryAction project={project({ kind: "developer", viewer_actions: [] })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows no dead control for Apply to join until #5 mounts it", () => {
    const { container } = render(<PrimaryAction project={project({ viewer_actions: ["apply_to_join"] })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
