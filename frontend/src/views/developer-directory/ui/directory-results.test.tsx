import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  sampleProfileGrowth,
  type DeveloperCardData,
  type DirectoryPage,
} from "@/entities/developer";

import { DirectoryResults } from "./directory-results";

const card = (id: number, name: string): DeveloperCardData => ({
  account_id: id,
  display_name: name,
  headline: "Developer",
  skills: [{ key: "react", label: "React" }],
  is_available: id === 1,
  project_count: 2,
  joined_at: "2026-11-10T12:00:00Z",
  // The API's 15-day rule; here simply every third developer.
  is_new_talent: id % 3 === 0,
});
const page = (changes: Partial<DirectoryPage>): DirectoryPage => ({
  results: [],
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 1,
  ...changes,
});

describe("DirectoryResults", () => {
  it("says an empty filtered result is empty and offers to clear the filters", () => {
    render(
      <DirectoryResults
        filters={{ ...NO_FILTERS, skills: ["Rust"] }}
        page={page({})}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "No developers match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/developers",
    );
  });

  it("explains an empty directory without offering filters to clear", () => {
    render(<DirectoryResults filters={NO_FILTERS} page={page({})} />);
    expect(
      screen.getByRole("heading", { name: "No developers yet" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
  });

  it("links each card to its portfolio and shows availability", () => {
    render(
      <DirectoryResults
        filters={NO_FILTERS}
        page={page({ results: [card(1, "Ada"), card(2, "Grace")], total: 2 })}
      />,
    );
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "/developers/1",
    );
    expect(screen.getByRole("link", { name: "Grace" })).toHaveAttribute(
      "href",
      "/developers/2",
    );
    expect(screen.getAllByText("Available for work")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 1–2 of 2 developers",
    );
  });

  it("shows New talent only for developers the API marks as new, ignoring the sample value", () => {
    const results = [card(1, "Ada"), card(3, "Linus")];
    expect(sampleProfileGrowth(1).is_new_talent).toBe(false);
    render(
      <DirectoryResults
        filters={NO_FILTERS}
        page={page({
          results: [
            { ...results[0], is_new_talent: true },
            { ...results[1], is_new_talent: false },
          ],
          total: 2,
        })}
      />,
    );
    expect(screen.getAllByText("New talent")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Ada" }).closest("li"),
    ).toHaveTextContent("New talent");
  });

  it("narrows the page by the new talent filter, using the API's value", () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      card(i + 1, `Dev ${i + 1}`),
    );
    const newcomers = results.filter((dev) => dev.is_new_talent);
    expect(newcomers.length).toBeGreaterThan(0);
    render(
      <DirectoryResults
        filters={{ ...NO_FILTERS, new_talent: true }}
        page={page({ results, total: 9 })}
      />,
    );
    const list = screen.getByRole("list", { name: "Developers" });
    expect(list.querySelectorAll(":scope > li")).toHaveLength(newcomers.length);
    expect(screen.getAllByText("New talent")).toHaveLength(newcomers.length);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Showing 1–9 of 9 developers. ${newcomers.length} on this page match the time zone and new talent filters.`,
    );
  });

  it("says when nobody on the page matches the planned filters, and offers to clear just those", () => {
    const zone = "Asia/Manila";
    const results = [card(1, "Ada"), card(2, "Grace")].filter(
      (dev) => sampleProfileGrowth(dev.account_id).time_zone !== zone,
    );
    render(
      <DirectoryResults
        filters={{ ...NO_FILTERS, skills: ["React"], time_zone: zone }}
        page={page({ results, total: 2 })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No developers on this page match" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clear time zone and new talent" }),
    ).toHaveAttribute("href", "/developers?skills=React");
  });

  it("pages keep the filters and the first page can't go back", () => {
    const filters = { ...NO_FILTERS, skills: ["React"], page: 1 };
    const results = Array.from({ length: 20 }, (_, i) =>
      card(i + 1, `Dev ${i + 1}`),
    );
    render(
      <DirectoryResults
        filters={filters}
        page={page({ results, total: 23, total_pages: 2 })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/developers?skills=React&page=2",
    );
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("handles a page number past the end", () => {
    render(
      <DirectoryResults
        filters={{ ...NO_FILTERS, page: 9 }}
        page={page({ page: 9, total: 3 })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "There's no page 9" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the first page" }),
    ).toHaveAttribute("href", "/developers");
  });
});
