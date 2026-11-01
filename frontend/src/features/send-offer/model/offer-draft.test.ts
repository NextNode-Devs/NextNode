import { describe, expect, it } from "vitest";

import { draftFromOffer, offerErrorsFromApi, toOfferBody, validateOffer, type OfferDraft } from "./offer-draft";

const TODAY = "2026-11-01";
const draft = (overrides: Partial<OfferDraft> = {}): OfferDraft => ({
  summary: "Five sprints: booking, payments, admin.",
  total: "10,000",
  start_date: "2026-11-09",
  delivery_date: "2027-02-01",
  ...overrides,
});

describe("validateOffer", () => {
  it("accepts a complete offer and sends whole cents", () => {
    expect(validateOffer(draft(), TODAY)).toEqual({});
    expect(toOfferBody(draft()).total_cents).toBe(1_000_000);
  });

  it("refuses CAD 1,499.99 and accepts CAD 1,500.00, like the API", () => {
    expect(validateOffer(draft({ total: "1499.99" }), TODAY).total_cents).toBe("Must be at least CAD 1,500.00.");
    expect(validateOffer(draft({ total: "1500.00" }), TODAY).total_cents).toBeUndefined();
  });

  it("names each field that needs attention", () => {
    const errors = validateOffer(
      draft({ summary: "short", total: "ten", start_date: "2026-10-01", delivery_date: "2026-09-01" }),
      TODAY,
    );
    expect(Object.keys(errors).sort()).toEqual(["delivery_date", "start_date", "summary", "total_cents"]);
  });
});

describe("draftFromOffer", () => {
  it("starts a revision from the declined version", () => {
    const declined = {
      summary: "Old plan with more scope.",
      total_cents: 1_234_550,
      start_date: "2026-11-09",
      delivery_date: "2027-02-01",
    } as Parameters<typeof draftFromOffer>[0];
    expect(draftFromOffer(declined).total).toBe("12345.50");
  });
});

it("puts the API's field errors on the form's fields", () => {
  expect(offerErrorsFromApi({ total_cents: ["Must be at least CAD 1,500.00."], other: ["x"] })).toEqual({
    total_cents: "Must be at least CAD 1,500.00.",
  });
});
