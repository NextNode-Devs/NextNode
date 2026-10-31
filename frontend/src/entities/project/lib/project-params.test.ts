import { describe, expect, it } from "vitest";

import { hasProjectFilters, NO_PROJECT_FILTERS, parseProjectParams, projectQuery } from "./project-params";

describe("project search params", () => {
  it("round-trips every filter through the URL", () => {
    const filters = { kind: "client" as const, tech: ["React", "Django"], needsLead: true, openSpots: true, page: 2 };
    const query = projectQuery(filters);
    expect(query).toBe("?kind=client&tech=Django%2CReact&needs_lead=true&open_spots=true&page=2");
    expect(parseProjectParams(new URLSearchParams(query.slice(1)))).toEqual({ ...filters, tech: ["Django", "React"] });
  });

  it("leaves defaults out, so the plain page has a plain URL", () => {
    expect(projectQuery(NO_PROJECT_FILTERS)).toBe("");
    expect(hasProjectFilters(NO_PROJECT_FILTERS)).toBe(false);
  });

  it("falls back to defaults for anything malformed instead of erroring", () => {
    expect(parseProjectParams({ kind: "robot", needs_lead: "yes", page: "-3" })).toEqual(NO_PROJECT_FILTERS);
  });

  it("keeps one spelling per technology, case-insensitively", () => {
    expect(parseProjectParams({ tech: "react, React ,  REACT,next.js" }).tech).toEqual(["next.js", "react"]);
  });
});
