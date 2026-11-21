import { describe, expect, it } from "vitest";

import { sampleProfileGrowth } from "../model/sample";
import {
  apiDirectoryQuery,
  directoryQuery,
  hasFilters,
  hasPlannedFilters,
  matchesPlannedFilters,
  NO_FILTERS,
  parseDirectoryParams,
  type DirectoryFilters,
} from "./directory-params";

const roundTrip = (filters: DirectoryFilters) =>
  parseDirectoryParams(new URLSearchParams(directoryQuery(filters).slice(1)));

describe("directory filters in the URL", () => {
  it("leaves defaults out, so the plain directory is just /developers", () => {
    expect(directoryQuery(NO_FILTERS)).toBe("");
    expect(parseDirectoryParams({})).toEqual(NO_FILTERS);
  });

  it.each<DirectoryFilters>([
    { ...NO_FILTERS, q: "ada" },
    { ...NO_FILTERS, skills: ["Django", "React"] },
    { ...NO_FILTERS, q: "full-stack dev", skills: ["C#", "Node.js"], available: true, page: 3 },
    { ...NO_FILTERS, available: true, page: 2 },
    { ...NO_FILTERS, time_zone: "America/Toronto", new_talent: true },
  ])("reproduces the same view after a round trip: %o", (filters) => {
    expect(roundTrip(filters)).toEqual(filters);
  });

  it("gives equal filters one URL whatever the order, spacing or case of skills", () => {
    const a = directoryQuery({ ...NO_FILTERS, q: "  ada  ", skills: ["React", "django"] });
    const b = directoryQuery({ ...NO_FILTERS, q: "ada", skills: [" django ", "REACT", "react"] });
    expect(a).toBe("?q=ada&skills=django%2CReact");
    expect(b).toBe("?q=ada&skills=django%2CREACT");
    expect(roundTrip(parseDirectoryParams(new URLSearchParams(a.slice(1)))).skills).toEqual(["django", "React"]);
  });

  it("reads Next.js searchParams objects as well as URLSearchParams", () => {
    expect(parseDirectoryParams({ q: ["ada", "ignored"], skills: "react", available: "true", page: "2" })).toEqual({
      ...NO_FILTERS,
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
    expect(parseDirectoryParams({ tz: "Mars/Olympus" }).time_zone).toBe("");
    expect(parseDirectoryParams({ new_talent: "1" }).new_talent).toBe(false);
    expect(parseDirectoryParams({ q: "x".repeat(150) }).q).toHaveLength(100);
    expect(parseDirectoryParams({ skills: Array.from({ length: 12 }, (_, i) => `s${i}`).join(",") }).skills).toHaveLength(10);
  });

  it("knows when any filter is on (the page number alone isn't one)", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, page: 4 })).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "ada" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, skills: ["React"] })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, available: true })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, time_zone: "Europe/London" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, new_talent: true })).toBe(true);
  });
});

describe("planned filters (#93: time zone and new talent)", () => {
  const planned: DirectoryFilters = { ...NO_FILTERS, q: "ada", time_zone: "America/Toronto", new_talent: true };

  it("stay in the page URL but are never sent to the API, which can't filter on them yet", () => {
    expect(directoryQuery(planned)).toBe("?q=ada&tz=America%2FToronto&new_talent=true");
    expect(apiDirectoryQuery(planned)).toBe("?q=ada");
    expect(hasPlannedFilters(planned)).toBe(true);
    expect(hasPlannedFilters({ ...NO_FILTERS, q: "ada" })).toBe(false);
  });

  it("narrow developers by their profile values, each filter on its own and together", () => {
    const growth = { ...sampleProfileGrowth(1), time_zone: "America/Toronto", is_new_talent: false };
    expect(matchesPlannedFilters(growth, { ...NO_FILTERS, time_zone: "America/Toronto" })).toBe(true);
    expect(matchesPlannedFilters(growth, { ...NO_FILTERS, time_zone: "Europe/London" })).toBe(false);
    expect(matchesPlannedFilters(growth, { ...NO_FILTERS, new_talent: true })).toBe(false);
    expect(matchesPlannedFilters({ ...growth, is_new_talent: true }, planned)).toBe(true);
  });

  it("let everyone through when off, and leave out developers with no values when on", () => {
    expect(matchesPlannedFilters(undefined, NO_FILTERS)).toBe(true);
    expect(matchesPlannedFilters(undefined, planned)).toBe(false);
    expect(matchesPlannedFilters({ ...sampleProfileGrowth(1), time_zone: null }, { ...NO_FILTERS, time_zone: "America/Toronto" })).toBe(false);
  });
});
