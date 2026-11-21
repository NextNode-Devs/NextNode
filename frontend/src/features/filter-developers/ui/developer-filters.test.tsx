import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NO_FILTERS, parseDirectoryParams } from "@/entities/developer";

import { DeveloperFilters } from "./developer-filters";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/browser-client", () => ({
  useApiClient: () => ({ get: async () => ({ ok: true, data: [] }) }),
}));

/** The filters a pushed URL describes: what a reload of that URL would show. */
const pushedFilters = (path = "/developers") => {
  const url = new URL(push.mock.lastCall?.[0] as string, "http://localhost");
  expect(url.pathname).toBe(path);
  return parseDirectoryParams(url.searchParams);
};

const renderFilters = (initial = NO_FILTERS, basePath = "/developers") =>
  render(<DeveloperFilters initial={initial} basePath={basePath} />);

describe("DeveloperFilters", () => {
  beforeEach(() => push.mockClear());

  it("puts the search text in the URL on Enter, back on page 1", async () => {
    const user = userEvent.setup();
    renderFilters({ ...NO_FILTERS, page: 3 });
    await user.type(screen.getByLabelText("Search"), "full-stack{Enter}");
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, q: "full-stack" });
  });

  it("applies a skill and the availability toggle at once, keeping the other filters", async () => {
    const user = userEvent.setup();
    renderFilters({ ...NO_FILTERS, q: "ada", skills: ["Django"], page: 2 });

    await user.type(screen.getByLabelText("Skills"), "React{Enter}");
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, q: "ada", skills: ["Django", "React"] });

    expect(screen.getByRole("list", { name: "Added skills" })).toHaveTextContent("React"); // shown at once

    await user.click(screen.getByLabelText("Available for work only"));
    expect(screen.getByLabelText("Available for work only")).toBeChecked(); // ticks at once, before results load
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, q: "ada", skills: ["Django", "React"], available: true });
  });

  it("applies the planned time zone and new talent filters at once, in the URL", async () => {
    const user = userEvent.setup();
    renderFilters({ ...NO_FILTERS, available: true });

    const zone = screen.getByLabelText("Time zone");
    expect(screen.getByRole("option", { name: "Eastern (Toronto) · EST (UTC-05:00)" })).toBeInTheDocument();
    await user.selectOptions(zone, "America/Toronto");
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, available: true, time_zone: "America/Toronto" });

    await user.click(screen.getByLabelText("New talent only"));
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, available: true, time_zone: "America/Toronto", new_talent: true });
    expect(screen.getByText(/only filter the page you're on/)).toBeInTheDocument();
  });

  it("explains each toggle from an info button", async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByRole("button", { name: "Explain the new talent filter" }));
    expect(await screen.findByText(/joined NextNode in the past 15 days/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Explain the availability filter" }));
    expect(await screen.findByText(/marked themselves as available for work/)).toBeInTheDocument();
  });

  it("folds the planned filters under More filters on a phone, open when one is on", async () => {
    const user = userEvent.setup();
    const { unmount } = renderFilters();
    const more = screen.getByRole("button", { name: /More filters/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Time zone").closest("[id$='-tz-field']")).toHaveClass("max-md:hidden");
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Time zone").closest("[id$='-tz-field']")).not.toHaveClass("max-md:hidden");
    unmount();

    renderFilters({ ...NO_FILTERS, new_talent: true });
    expect(screen.getByRole("button", { name: /More filters/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /More filters/ })).toHaveTextContent("1 on");
  });

  it("pushes to the page it belongs to, so Hire Devs can reuse it", async () => {
    const user = userEvent.setup();
    renderFilters(NO_FILTERS, "/projects/7/hire");
    await user.click(screen.getByLabelText("New talent only"));
    expect(pushedFilters("/projects/7/hire")).toEqual({ ...NO_FILTERS, new_talent: true });
  });

  it("shows the filters the URL holds, and clears them all", async () => {
    const user = userEvent.setup();
    renderFilters({ ...NO_FILTERS, q: "ada", skills: ["React"], available: true, time_zone: "Europe/London" });
    expect(screen.getByLabelText("Search")).toHaveValue("ada");
    expect(screen.getByRole("list", { name: "Added skills" })).toHaveTextContent("React");
    expect(screen.getByLabelText("Available for work only")).toBeChecked();
    expect(screen.getByLabelText("Time zone")).toHaveValue("Europe/London");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenLastCalledWith("/developers", { scroll: false });
  });

  it("offers no Clear button when nothing is filtered", () => {
    renderFilters();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
