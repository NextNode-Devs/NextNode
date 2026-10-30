import { describe, expect, it } from "vitest";

import { formatMoney } from "./format-money";

describe("formatMoney", () => {
  it.each([
    [200_000, "CAD 2,000.00"],
    [30_000, "CAD 300.00"],
    [30_001, "CAD 300.01"],
    [5, "CAD 0.05"],
    [123_456_789, "CAD 1,234,567.89"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatMoney(cents, "cad")).toBe(expected);
  });
});
