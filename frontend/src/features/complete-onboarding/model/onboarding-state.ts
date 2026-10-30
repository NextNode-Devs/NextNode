import type { ApiError } from "@/shared/api/types";

import type { FieldName } from "./schema";

export type FieldErrors = Partial<Record<FieldName, string>>;

/** What the form shows after a failed submit. Success redirects instead. */
export type OnboardingState = {
  code: string;
  message: string;
  fields: FieldErrors;
  /** Submitted values, so a failed submit doesn't wipe what was typed. */
  values: Record<string, string>;
} | null;

/** Backend field paths (`developer.skills`, `client.company_name`) → form fields. */
export function fieldErrorsFromApi(error: ApiError): FieldErrors {
  const fields: FieldErrors = {};
  for (const [path, messages] of Object.entries(error.fields ?? {})) {
    const name = path.split(".").pop() as FieldName;
    if (messages[0]) fields[name] ??= messages[0];
  }
  return fields;
}

export function onboardingErrorMessage(error: ApiError): string {
  switch (error.code) {
    case "ALREADY_ONBOARDED":
      return error.message;
    case "UNAUTHENTICATED":
      return "Your session has ended. Sign in again to finish setting up your account.";
    case "VALIDATION_ERROR":
      return "Some details need attention. Check the highlighted fields.";
    case "UNREACHABLE":
    case "BAD_RESPONSE":
      return "We couldn't reach NextNode. Check your connection and try again.";
    default:
      return error.message || "Something went wrong. Try again.";
  }
}
