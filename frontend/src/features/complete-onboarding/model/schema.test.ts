import { describe, expect, it } from "vitest";

import { fieldErrorsFromApi } from "./onboarding-state";
import { onboardingSchema, toRequestBody } from "./schema";

const developer = {
  role: "developer",
  display_name: "Ada",
  headline: "Full-stack developer",
  bio: "",
  github_username: "@ada-l",
  skills: ["React", "Python"],
};

describe("onboarding schema", () => {
  it("accepts a client and builds the API body with only client details", () => {
    const parsed = onboardingSchema.parse({
      role: "client",
      display_name: " Grace ",
      company_name: "Acme",
      industry: "Retail",
    });
    expect(toRequestBody(parsed)).toEqual({
      role: "client",
      display_name: "Grace",
      client: { company_name: "Acme", industry: "Retail" },
    });
  });

  it("strips the @ from a GitHub username and sends an empty one as null", () => {
    const body = toRequestBody(onboardingSchema.parse(developer));
    expect(body).toMatchObject({ developer: { github_username: "ada-l", skills: ["React", "Python"] } });
    const none = toRequestBody(onboardingSchema.parse({ ...developer, github_username: "" }));
    expect(none).toMatchObject({ developer: { github_username: null } });
  });

  it.each([
    [{ ...developer, skills: [] }, "skills"],
    [{ ...developer, skills: ["React", "react "] }, "skills"],
    [{ ...developer, skills: ["<b>"] }, "skills"],
    [{ ...developer, github_username: "-bad" }, "github_username"],
    [{ ...developer, headline: "  " }, "headline"],
    [{ ...developer, display_name: "x".repeat(81) }, "display_name"],
    [{ ...developer, role: "admin" }, "role"],
  ])("refuses invalid input on the right field (%#)", (input, field) => {
    const result = onboardingSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => (issue.path[0] ?? "role") === field)).toBe(true);
  });

  it("maps backend field paths onto form fields", () => {
    expect(
      fieldErrorsFromApi({
        code: "VALIDATION_ERROR",
        message: "x",
        fields: { "developer.skills": ["Listed twice."], display_name: ["Too long."] },
      }),
    ).toEqual({ skills: "Listed twice.", display_name: "Too long." });
  });
});
