import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { compareMatches, sampleProfileGrowth, scoreMatch, type DeveloperMatch } from "@/entities/developer";

import { SuggestedDevelopers } from "./suggested-developers";

const s = (label: string) => ({ key: label.toLowerCase(), label });
const STACK = ["React", "Django", "Docker"].map(s);

function ranked(people: [number, string, string[], boolean][]): DeveloperMatch[] {
  return people
    .map(([account_id, display_name, skills, is_available]) => {
      const developer = { account_id, display_name, headline: "", skills: skills.map(s), is_available, project_count: 0, joined_at: null, is_new_talent: false };
      return { developer, growth: sampleProfileGrowth(account_id), match: scoreMatch(STACK, developer) };
    })
    .sort(compareMatches);
}

const actions = (entry: DeveloperMatch) => <button type="button">Invite {entry.developer.display_name}</button>;

describe("SuggestedDevelopers", () => {
  it("shows the top 3 with a score and the reason, and skips anyone with no required skill", () => {
    const entries = ranked([
      [1, "Ada", ["React", "Django"], true],
      [2, "Bea", ["React", "Django", "Docker"], true],
      [3, "Cy", ["Rust"], true],
      [4, "Dee", ["React"], false],
      [5, "Eve", ["Docker"], true],
    ]);
    render(<SuggestedDevelopers ranked={entries} requiredCount={3} actions={actions} />);

    const rows = [...screen.getByRole("list", { name: "Suggested developers" }).children] as HTMLElement[];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bea"),
      expect.stringContaining("Ada"),
      expect.stringContaining("Eve"),
    ]);
    expect(rows[0]).toHaveTextContent("3 of 3 required skills, available now");
    expect(rows[0]).toHaveTextContent("every required skill");
    expect(rows[1]).toHaveTextContent("could learn Docker");
    expect(screen.getByRole("meter", { name: "Bea's match score" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.queryByText(/Cy/)).toBeNull();
    expect(screen.getByRole("button", { name: "Invite Ada" })).toBeInTheDocument();
  });

  it("says why there are no suggestions", () => {
    const { rerender } = render(<SuggestedDevelopers ranked={ranked([[3, "Cy", ["Rust"], true]])} requiredCount={3} actions={actions} />);
    expect(screen.getByText(/Nobody has any of your required skills yet/)).toBeInTheDocument();
    rerender(<SuggestedDevelopers ranked={[]} requiredCount={0} actions={actions} />);
    expect(screen.getByText(/no tech stack yet/)).toBeInTheDocument();
  });
});
