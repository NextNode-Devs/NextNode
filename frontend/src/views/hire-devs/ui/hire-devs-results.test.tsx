import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NO_FILTERS, SAMPLE_HIRE_DEVS_POOL } from "@/entities/developer";

import { rankDevelopers } from "../model/hire-devs";
import { HireDevsResults } from "./hire-devs-results";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (feature: string) => underConstruction(feature) }));

const skill = (label: string) => ({ key: label.toLowerCase(), label });
const stack = { tech_stack: ["React", "TypeScript", "Django", "PostgreSQL", "Docker"].map(skill) };
const base = "/projects/4/hire-devs";

describe("HireDevsResults", () => {
  it("shows every card's score and the reason for it, best match first", () => {
    const matches = rankDevelopers(SAMPLE_HIRE_DEVS_POOL, stack, NO_FILTERS);
    render(<HireDevsResults matches={matches} filters={NO_FILTERS} basePath={base} requiredCount={5} />);
    const cards = screen.getAllByRole("listitem").filter((item) => item.querySelector("h3"));
    expect(cards).toHaveLength(SAMPLE_HIRE_DEVS_POOL.length);
    // Amara has React, TypeScript, Django and PostgreSQL, and is available.
    expect(cards[0]).toHaveTextContent("Amara Okafor");
    expect(cards[0]).toHaveTextContent("83% match");
    expect(cards[0]).toHaveTextContent("4 of 5 required skills, available now");
    expect(cards[0]).toHaveTextContent("Doesn't list: Docker");
  });

  it("shows New talent from the developer's card, as the API marks it", () => {
    const matches = rankDevelopers(SAMPLE_HIRE_DEVS_POOL, stack, NO_FILTERS);
    render(<HireDevsResults matches={matches} filters={NO_FILTERS} basePath={base} requiredCount={5} />);
    const cardOf = (name: string) => screen.getByRole("heading", { name }).closest("li");
    const newcomers = SAMPLE_HIRE_DEVS_POOL.filter((d) => d.is_new_talent);
    expect(screen.getAllByText("New talent")).toHaveLength(newcomers.length);
    expect(cardOf("Zainab Yusuf")).toHaveTextContent("New talent");
    expect(cardOf("Noah Fischer")).not.toHaveTextContent("New talent");
  });

  it("uses the under-construction toast for actions that aren't built", async () => {
    const user = userEvent.setup();
    const matches = rankDevelopers(SAMPLE_HIRE_DEVS_POOL.slice(0, 1), stack, NO_FILTERS);
    render(<HireDevsResults matches={matches} filters={NO_FILTERS} basePath={base} requiredCount={5} />);
    await user.click(screen.getByRole("button", { name: "Invite Amara Okafor to your team" }));
    expect(underConstruction).toHaveBeenCalledWith("Invite to team");
  });

  it("offers to clear filters when nothing matches them", () => {
    render(<HireDevsResults matches={[]} filters={{ ...NO_FILTERS, skills: ["Rust"] }} basePath={base} requiredCount={5} />);
    expect(screen.getByRole("heading", { name: "No developers match these filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", base);
  });

  it("explains an empty pool without offering filters to clear", () => {
    render(<HireDevsResults matches={[]} filters={NO_FILTERS} basePath={base} requiredCount={5} />);
    expect(screen.getByRole("heading", { name: "No developers to suggest yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("says when the score is availability only", () => {
    const matches = rankDevelopers(SAMPLE_HIRE_DEVS_POOL, { tech_stack: [] }, NO_FILTERS);
    render(<HireDevsResults matches={matches} filters={NO_FILTERS} basePath={base} requiredCount={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("the score is availability only");
  });
});
