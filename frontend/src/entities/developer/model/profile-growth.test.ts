import { describe, expect, it } from "vitest";

import { TIME_ZONE_OPTIONS, timeZoneLabel, timeZoneOptionLabel, timeZoneWithCode } from "./profile-growth";
import { sampleProfileGrowth } from "./sample";

describe("planned profile fields", () => {
  it("labels listed zones, keeps unknown ones as given, and says when none is set", () => {
    expect(timeZoneLabel("America/Toronto")).toBe("Eastern (Toronto)");
    expect(timeZoneLabel("Pacific/Auckland")).toBe("Pacific/Auckland");
    expect(timeZoneLabel(null)).toBe("Not set");
  });

  it("adds the standard-time code, and the offset for filter options (#93)", () => {
    expect(timeZoneWithCode("America/Toronto")).toBe("Eastern (Toronto) · EST");
    expect(timeZoneOptionLabel(TIME_ZONE_OPTIONS[0])).toBe("Newfoundland (St. John's) · NST (UTC-03:30)");
    expect(timeZoneWithCode("Pacific/Auckland")).toBe("Pacific/Auckland");
    expect(timeZoneWithCode(null)).toBe("Not set");
  });

  it("offers each zone once", () => {
    const values = TIME_ZONE_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives the same sample values for the same developer (safe to render on server and browser)", () => {
    expect(sampleProfileGrowth(42)).toEqual(sampleProfileGrowth(42));
  });

  it("covers every case the filters need: new talent or not, a zone or none, certificates or none", () => {
    const samples = Array.from({ length: 21 }, (_, i) => sampleProfileGrowth(i + 1));
    expect(samples.some((s) => s.is_new_talent)).toBe(true);
    expect(samples.some((s) => !s.is_new_talent)).toBe(true);
    expect(samples.some((s) => s.time_zone === null)).toBe(true);
    expect(samples.some((s) => s.time_zone !== null)).toBe(true);
    expect(samples.some((s) => s.certificates.length > 0)).toBe(true);
    expect(samples.some((s) => s.certificates.length === 0)).toBe(true);
  });
});
