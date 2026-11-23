import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { suggestDevelopers, type DeveloperCardData } from "@/entities/developer";

import { SuggestionList } from "./suggestion-list";

const s = (label: string) => ({ key: label.toLowerCase(), label });
const dev = (account_id: number, display_name: string, skills: string[], is_available = true): DeveloperCardData => ({
  account_id,
  display_name,
  headline: `${display_name}'s headline`,
  skills: skills.map(s),
  is_available,
  project_count: 0,
  joined_at: null,
  is_new_talent: false,
});

describe("SuggestionList", () => {
  it("shows each suggestion's score, reason, skills it has and skills it misses", () => {
    const stack = ["React", "Django", "Docker"].map(s);
    const suggestions = suggestDevelopers(stack, [dev(1, "Ada", ["React", "Django"]), dev(2, "Bea", ["React"], false)]);
    render(<SuggestionList suggestions={suggestions} />);

    // Top-level rows only (each row has its own list of skills inside).
    const rows = [...screen.getByRole("list", { name: "Suggested developers" }).children] as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ada");
    expect(rows[0]).toHaveTextContent("2 of 3 required skills, available now");
    expect(rows[0]).toHaveTextContent("Missing: Docker");
    expect(within(rows[0]).getByRole("meter", { name: "Match score" })).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("1 of 3 required skills, not available right now")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /portfolio to invite them/ })[0]).toHaveAttribute("href", "/developers/1");
  });
});
