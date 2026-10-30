import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NO_FILTERS, parseDirectoryParams } from "@/entities/developer";

import { DirectoryFilters } from "./directory-filters";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/browser-client", () => ({
  useApiClient: () => ({ get: async () => ({ ok: true, data: [] }) }),
}));

/** The filters a pushed URL describes: what a reload of that URL would show. */
const pushedFilters = () => {
  const url = new URL(push.mock.lastCall?.[0] as string, "http://localhost");
  expect(url.pathname).toBe("/developers");
  return parseDirectoryParams(url.searchParams);
};

describe("DirectoryFilters", () => {
  beforeEach(() => push.mockClear());

  it("puts the search text in the URL on Enter, back on page 1", async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters initial={{ ...NO_FILTERS, page: 3 }} />);
    await user.type(screen.getByLabelText("Search"), "full-stack{Enter}");
    expect(pushedFilters()).toEqual({ ...NO_FILTERS, q: "full-stack" });
  });

  it("applies a skill and the availability toggle at once, keeping the other filters", async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters initial={{ q: "ada", skills: ["Django"], available: false, page: 2 }} />);

    await user.type(screen.getByLabelText("Skills"), "React{Enter}");
    expect(pushedFilters()).toEqual({ q: "ada", skills: ["Django", "React"], available: false, page: 1 });

    expect(screen.getByRole("list", { name: "Added skills" })).toHaveTextContent("React"); // shown at once

    await user.click(screen.getByLabelText("Available for work only"));
    expect(screen.getByLabelText("Available for work only")).toBeChecked(); // ticks at once, before results load
    expect(pushedFilters()).toEqual({ q: "ada", skills: ["Django", "React"], available: true, page: 1 });
  });

  it("shows the filters the URL holds, and clears them all", async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters initial={{ q: "ada", skills: ["React"], available: true, page: 1 }} />);
    expect(screen.getByLabelText("Search")).toHaveValue("ada");
    expect(screen.getByRole("list", { name: "Added skills" })).toHaveTextContent("React");
    expect(screen.getByLabelText("Available for work only")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenLastCalledWith("/developers", { scroll: false });
  });

  it("offers no Clear button when nothing is filtered", () => {
    render(<DirectoryFilters initial={NO_FILTERS} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
