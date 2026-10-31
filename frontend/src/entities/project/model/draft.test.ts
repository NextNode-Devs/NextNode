import { describe, expect, it } from "vitest";

import { EMPTY_DRAFT, parseBudget, saveFailureFrom, toRequestBody, validateDraft, type ProjectDraft } from "./draft";

const TODAY = "2026-10-31";
const DRAFT: ProjectDraft = {
  title: "Booking app",
  description: "A booking app for a small yoga studio.",
  tech_stack: ["React"],
  target_delivery_date: "2027-02-01",
  budget: "2,500",
};

describe("parseBudget", () => {
  it.each([
    ["1500", 150_000],
    ["1,500.5", 150_050],
    ["$2,500.00", 250_000],
    [" 1500 ", 150_000],
  ])("reads %s as %i cents", (text, cents) => expect(parseBudget(text)).toBe(cents));

  it.each(["", "abc", "1.234", "-5", "1e5"])("refuses %s", (text) => expect(parseBudget(text)).toBeNull());
});

describe("validateDraft", () => {
  it("accepts a complete brief", () => {
    expect(validateDraft("client", DRAFT, TODAY)).toEqual({});
  });

  it("names every missing field at once", () => {
    expect(Object.keys(validateDraft("client", EMPTY_DRAFT, TODAY)).sort()).toEqual([
      "description",
      "proposed_budget_cents",
      "target_delivery_date",
      "tech_stack",
      "title",
    ]);
  });

  it("refuses a budget under CAD 1,500.00 on the budget field", () => {
    expect(validateDraft("client", { ...DRAFT, budget: "1499.99" }, TODAY)).toEqual({
      proposed_budget_cents: "Must be at least CAD 1,500.00.",
    });
  });

  it("refuses a delivery date that isn't after today", () => {
    expect(validateDraft("client", { ...DRAFT, target_delivery_date: TODAY }, TODAY)).toHaveProperty(
      "target_delivery_date",
    );
  });

  it("never asks a developer idea for a budget", () => {
    expect(validateDraft("developer", { ...DRAFT, budget: "" }, TODAY)).toEqual({});
  });
});

describe("toRequestBody", () => {
  it("sends the budget in cents for a brief, and no budget key at all for an idea", () => {
    expect(toRequestBody("client", DRAFT)).toMatchObject({ proposed_budget_cents: 250_000 });
    expect(toRequestBody("developer", DRAFT)).not.toHaveProperty("proposed_budget_cents");
  });
});

describe("saveFailureFrom", () => {
  it("puts the API's field messages on the fields", () => {
    const failure = saveFailureFrom({
      code: "VALIDATION_ERROR",
      message: "Must be at least CAD 1,500.00; this is CAD 1,000.00.",
      fields: { proposed_budget_cents: ["Must be at least CAD 1,500.00."] },
    });
    expect(failure.fields).toEqual({ proposed_budget_cents: "Must be at least CAD 1,500.00." });
  });

  it("shows the API's reason for a refusal like a locked brief", () => {
    const message = "This project has a Team Lead now, so its brief can no longer be edited.";
    expect(saveFailureFrom({ code: "CONFLICT", message }).message).toBe(message);
  });
});
