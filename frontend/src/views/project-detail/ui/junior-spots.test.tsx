import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";
import { getToasts, resetToasts } from "@/shared/lib/toast";

import { JuniorSpots } from "./junior-spots";

afterEach(() => act(() => resetToasts()));

const project = (viewer: Partial<Project["viewer"]>, team: Partial<Project["team"]> = {}) =>
  ({
    id: 4,
    team: { id: 1, status: "open", size: 6, headcount: 3, open_spots: 3, ...team },
    viewer: { is_owner: false, is_lead: false, is_member: false, ...viewer },
  }) as Project;

describe("JuniorSpots", () => {
  it("lets the Team Lead mark open spots junior and links to new talent in Hire Devs and the directory", async () => {
    const user = userEvent.setup();
    render(<JuniorSpots project={project({ is_lead: true })} />);
    expect(screen.getByText("1 of 3 open spots is for junior developers.")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Open spot 2: junior" }));
    expect(screen.getByText("2 of 3 open spots are for junior developers.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save junior spots" }));
    expect(getToasts().at(-1)?.description).toBe("Save junior spots: this function is under construction.");
    expect(screen.getByText("Shown here only. Nothing was saved.")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Matched new talent" })).toHaveAttribute("href", "/projects/4/hire-devs?new_talent=true");
    expect(screen.getByRole("link", { name: "Browse new talent" })).toHaveAttribute("href", "/developers?new_talent=true");
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("shows everyone else how many spots are junior, with the new-talent badge", () => {
    render(<JuniorSpots project={project({})} />);
    expect(screen.getByText("1 of 3 open spots is for junior developers.")).toBeInTheDocument();
    expect(screen.getByText("New talent")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("asks the Lead to set the team size first", () => {
    render(<JuniorSpots project={project({ is_lead: true }, { size: null, open_spots: 0 })} />);
    expect(screen.getByText(/Set the team size first/)).toBeInTheDocument();
  });

  it("is hidden when the team is full, closed, or has no junior spot to show", () => {
    const { container, rerender } = render(<JuniorSpots project={project({ is_lead: true }, { open_spots: 0 })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<JuniorSpots project={project({}, { status: "active" })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<JuniorSpots project={project({}, { open_spots: 1 })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
