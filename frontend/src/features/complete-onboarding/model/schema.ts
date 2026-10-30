import { z } from "zod";

import { MAX_SKILLS, SKILL_MAX_LENGTH, SKILL_PATTERN, skillKey } from "@/entities/skill";

/** Mirrors `nextnode.domain.accounts` so most mistakes are caught before the
 * request; the backend stays the authority and its field errors are shown too. */
export const LIMITS = {
  displayName: 80,
  companyName: 120,
  industry: 80,
  headline: 120,
  bio: 2000,
} as const;

const GITHUB_USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(max, `Use at most ${max} characters.`);

const skills = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Remove the empty skill.")
      .max(SKILL_MAX_LENGTH, `Each skill can be at most ${SKILL_MAX_LENGTH} characters.`)
      .regex(SKILL_PATTERN, "Skills can use letters, numbers, spaces and + # . - / only."),
  )
  .min(1, "Add at least one skill.")
  .max(MAX_SKILLS, `Add at most ${MAX_SKILLS} skills.`)
  .refine((list) => new Set(list.map(skillKey)).size === list.length, "A skill is listed twice.");

export const clientSchema = z.object({
  role: z.literal("client"),
  display_name: required("display name", LIMITS.displayName),
  company_name: required("company name", LIMITS.companyName),
  industry: required("industry", LIMITS.industry),
});

export const developerSchema = z.object({
  role: z.literal("developer"),
  display_name: required("display name", LIMITS.displayName),
  headline: required("headline", LIMITS.headline),
  bio: z.string().trim().max(LIMITS.bio, `Use at most ${LIMITS.bio} characters.`),
  github_username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .refine((value) => value === "" || GITHUB_USERNAME.test(value), "Use 1-39 letters, numbers or single hyphens."),
  skills,
});

export const onboardingSchema = z.discriminatedUnion("role", [clientSchema, developerSchema], {
  error: () => "Choose Developer or Client.",
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type FieldName =
  | "role"
  | "display_name"
  | "company_name"
  | "industry"
  | "headline"
  | "bio"
  | "github_username"
  | "skills";

/** The API request body (`POST /api/onboarding/`). */
export function toRequestBody(input: OnboardingInput) {
  if (input.role === "client") {
    return {
      role: "client",
      display_name: input.display_name,
      client: { company_name: input.company_name, industry: input.industry },
    };
  }
  return {
    role: "developer",
    display_name: input.display_name,
    developer: {
      headline: input.headline,
      bio: input.bio,
      github_username: input.github_username || null,
      skills: input.skills,
    },
  };
}
