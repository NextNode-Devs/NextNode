import { describe, expect, it } from "vitest";

import { formatMessageTime } from "./format-date";

describe("formatMessageTime", () => {
  it("shows the day and time in Toronto time", () => {
    // 14:42 UTC is 10:42 in Toronto (EDT, UTC-4).
    expect(formatMessageTime("2026-10-30T14:42:00Z")).toMatch(/Oct\.? 30.*10:42/);
  });

  it("shows only the time when the reference is the same Toronto day", () => {
    const text = formatMessageTime("2026-10-30T14:42:00Z", "2026-10-30T20:00:00Z");
    expect(text).toMatch(/10:42/);
    expect(text).not.toMatch(/Oct/);
  });

  it("uses the Toronto day, not the UTC day", () => {
    // 02:00 UTC on the 31st is still the 30th in Toronto.
    expect(formatMessageTime("2026-10-31T02:00:00Z", "2026-10-30T14:00:00Z")).not.toMatch(/Oct/);
  });

  it.each([null, undefined, "", "not a date"])("is empty for %o", (value) => {
    expect(formatMessageTime(value)).toBe("");
  });
});
