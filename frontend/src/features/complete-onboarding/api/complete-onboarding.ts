"use server";

import { redirect } from "next/navigation";

import { apiPost } from "@/shared/api/server-client";

import {
  fieldErrorsFromApi,
  onboardingErrorMessage,
  type FieldErrors,
  type OnboardingState,
} from "../model/onboarding-state";
import { onboardingSchema, toRequestBody, type FieldName } from "../model/schema";

function read(form: FormData) {
  const text = (name: string) => String(form.get(name) ?? "");
  return {
    role: text("role"),
    display_name: text("display_name"),
    company_name: text("company_name"),
    industry: text("industry"),
    headline: text("headline"),
    bio: text("bio"),
    github_username: text("github_username"),
    skills: form.getAll("skills").map(String),
  };
}

/**
 * Creates the signed-in user's account (`POST /api/onboarding/`) and sends
 * them to the dashboard. The role can be chosen only once; the backend
 * enforces that, this only reports it.
 */
export async function completeOnboarding(_previous: OnboardingState, form: FormData): Promise<OnboardingState> {
  const raw = read(form);
  const values = { ...raw, skills: raw.skills.join("\n") };
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const name = (issue.path[0] ?? "role") as FieldName;
      fields[name] ??= issue.message;
    }
    return {
      code: "VALIDATION_ERROR",
      message: "Some details need attention. Check the highlighted fields.",
      fields,
      values,
    };
  }

  const result = await apiPost("/api/onboarding/", toRequestBody(parsed.data), { auth: true, timeoutMs: 8000 });
  if (!result.ok) {
    return {
      code: result.error.code,
      message: onboardingErrorMessage(result.error),
      fields: fieldErrorsFromApi(result.error),
      values,
    };
  }
  redirect("/dashboard"); // outside any try: it throws to navigate
}
