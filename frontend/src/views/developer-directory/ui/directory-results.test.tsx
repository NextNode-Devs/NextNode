import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NO_FILTERS, type DeveloperCardData, type DirectoryPage } from "@/entities/developer";

import { DirectoryResults } from "./directory-results";

const card = (id: number, name: string): DeveloperCardData => ({
  account_id: id,
  display_name: name,
  headline: "Developer",
  skills: [{ key: "react", label: "React" }],
  is_available: id === 1,
  project_count: 2,
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
    render(<DirectoryResults filters={{ ...NO_FILTERS, skills: ["Rust"] }} page={page({})} />);
    expect(screen.getByRole("heading", { name: "No developers match these filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/developers");
  });

  it("explains an empty directory without offering filters to clear", () => {
    render(<DirectoryResults filters={NO_FILTERS} page={page({})} />);
    expect(screen.getByRole("heading", { name: "No developers yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("links each card to its portfolio and shows availability", () => {
    render(<DirectoryResults filters={NO_FILTERS} page={page({ results: [card(1, "Ada"), card(2, "Grace")], total: 2 })} />);
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute("href", "/developers/1");
    expect(screen.getByRole("link", { name: "Grace" })).toHaveAttribute("href", "/developers/2");
    expect(screen.getAllByText("Available for work")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–2 of 2 developers");
  });

  it("pages keep the filters and the first page can't go back", () => {
    const filters = { ...NO_FILTERS, skills: ["React"], page: 1 };
    const results = Array.from({ length: 20 }, (_, i) => card(i + 1, `Dev ${i + 1}`));
    render(<DirectoryResults filters={filters} page={page({ results, total: 23, total_pages: 2 })} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/developers?skills=React&page=2");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("handles a page number past the end", () => {
    render(<DirectoryResults filters={{ ...NO_FILTERS, page: 9 }} page={page({ page: 9, total: 3 })} />);
    expect(screen.getByRole("heading", { name: "There's no page 9" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute("href", "/developers");
  });
});
