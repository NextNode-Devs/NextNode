import { describe, expect, it } from "vitest";

import { directoryQuery, hasFilters, NO_FILTERS, parseDirectoryParams, type DirectoryFilters } from "./directory-params";

const roundTrip = (filters: DirectoryFilters) =>
  parseDirectoryParams(new URLSearchParams(directoryQuery(filters).slice(1)));

describe("directory filters in the URL", () => {
  it("leaves defaults out, so the plain directory is just /developers", () => {
    expect(directoryQuery(NO_FILTERS)).toBe("");
    expect(parseDirectoryParams({})).toEqual(NO_FILTERS);
  });

  it.each<DirectoryFilters>([
    { q: "ada", skills: [], available: false, page: 1 },
    { q: "", skills: ["Django", "React"], available: false, page: 1 },
    { q: "full-stack dev", skills: ["C#", "Node.js"], available: true, page: 3 },
    { q: "", skills: [], available: true, page: 2 },
  ])("reproduces the same view after a round trip: %o", (filters) => {
    expect(roundTrip(filters)).toEqual(filters);
  });

  it("gives equal filters one URL whatever the order, spacing or case of skills", () => {
    const a = directoryQuery({ q: "  ada  ", skills: ["React", "django"], available: false, page: 1 });
    const b = directoryQuery({ q: "ada", skills: [" django ", "REACT", "react"], available: false, page: 1 });
    expect(a).toBe("?q=ada&skills=django%2CReact");
    expect(b).toBe("?q=ada&skills=django%2CREACT");
    expect(roundTrip(parseDirectoryParams(new URLSearchParams(a.slice(1)))).skills).toEqual(["django", "React"]);
  });

  it("reads Next.js searchParams objects as well as URLSearchParams", () => {
    expect(parseDirectoryParams({ q: ["ada", "ignored"], skills: "react", available: "true", page: "2" })).toEqual({
      q: "ada",
      skills: ["react"],
      available: true,
      page: 2,
    });
  });

  it("falls back to defaults for anything malformed instead of erroring", () => {
    expect(parseDirectoryParams({ page: "0" }).page).toBe(1);
    expect(parseDirectoryParams({ page: "two" }).page).toBe(1);
    expect(parseDirectoryParams({ page: "1.5" }).page).toBe(1);
    expect(parseDirectoryParams({ available: "yes" }).available).toBe(false);
    expect(parseDirectoryParams({ q: "x".repeat(150) }).q).toHaveLength(100);
    expect(parseDirectoryParams({ skills: Array.from({ length: 12 }, (_, i) => `s${i}`).join(",") }).skills).toHaveLength(10);
  });

  it("knows when any filter is on (the page number alone isn't one)", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, page: 4 })).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "ada" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, skills: ["React"] })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, available: true })).toBe(true);
  });
});
