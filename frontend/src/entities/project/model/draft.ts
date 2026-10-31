import { formatMoney } from "@/shared/lib/format-money";

import { PROJECT_LIMITS as L, type Project, type ProjectKind } from "./project";

/** A project form's fields, as typed. The budget is dollars as text; it is sent as whole cents. */
export type ProjectDraft = {
  title: string;
  description: string;
  tech_stack: string[];
  target_delivery_date: string; // yyyy-mm-dd, from <input type="date">
  budget: string;
};

/** Field paths are the API's own (`title`, `proposed_budget_cents`), so its errors land on the right field. */
export type FieldErrors = Record<string, string>;

export const EMPTY_DRAFT: ProjectDraft = {
  title: "",
  description: "",
  tech_stack: [],
  target_delivery_date: "",
  budget: "",
};

export function draftFrom(project: Project): ProjectDraft {
  const cents = project.proposed_budget_cents;
  return {
    title: project.title,
    description: project.description,
    tech_stack: project.tech_stack.map((skill) => skill.label),
    target_delivery_date: project.target_delivery_date,
    budget: cents === undefined ? "" : (cents / 100).toFixed(2),
  };
}

/** "1,500" or "$1500.50" → 150050 cents; `null` when it isn't an amount. */
export function parseBudget(text: string): number | null {
  const cleaned = text.replace(/[\s,$]/g, "").replace(/^CAD/i, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** The request body. Developer ideas send no budget field at all. */
export function toRequestBody(kind: ProjectKind, draft: ProjectDraft) {
  const body = {
    title: draft.title,
    description: draft.description,
    tech_stack: draft.tech_stack,
    target_delivery_date: draft.target_delivery_date,
  };
  return kind === "client" ? { ...body, proposed_budget_cents: parseBudget(draft.budget) } : body;
}

/** Catches what it can before saving; the API is the authority and repeats every check. */
export function validateDraft(kind: ProjectKind, draft: ProjectDraft, today: string): FieldErrors {
  const errors: FieldErrors = {};
  const title = draft.title.trim();
  if (title.length < L.titleMin || title.length > L.title) {
    errors.title = `Use ${L.titleMin} to ${L.title} characters.`;
  }
  const description = draft.description.trim();
  if (description.length < L.descriptionMin || description.length > L.description) {
    errors.description = `Use ${L.descriptionMin} to ${String(L.description).replace(/\B(?=(\d{3})+$)/g, ",")} characters.`;
  }
  if (draft.tech_stack.length === 0) errors.tech_stack = "Add at least one technology.";
  else if (draft.tech_stack.length > L.techStack) errors.tech_stack = `Add at most ${L.techStack} technologies.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.target_delivery_date)) {
    errors.target_delivery_date = "Choose a target delivery date.";
  } else if (draft.target_delivery_date <= today) {
    errors.target_delivery_date = "Choose a date after today.";
  }
  if (kind === "client") {
    const cents = parseBudget(draft.budget);
    if (draft.budget.trim() === "") errors.proposed_budget_cents = "Propose a budget.";
    else if (cents === null) errors.proposed_budget_cents = "Enter an amount in dollars, e.g. 2500 or 2,500.00.";
    else if (cents < L.minBudgetCents) {
      errors.proposed_budget_cents = `Must be at least ${formatMoney(L.minBudgetCents, "cad")}.`;
    } else if (cents > L.maxBudgetCents) {
      errors.proposed_budget_cents = `Must be at most ${formatMoney(L.maxBudgetCents, "cad")}.`;
    }
  }
  return errors;
}

/** The API's `fields` (lists of messages) → one message per field. */
export function fieldErrorsFromApi(fields: Record<string, string[]> | undefined): FieldErrors {
  const errors: FieldErrors = {};
  for (const [path, messages] of Object.entries(fields ?? {})) {
    if (messages[0]) errors[path] = messages[0];
  }
  return errors;
}

/** An API refusal as the form shows it: a summary, plus messages on the fields. */
export function saveFailureFrom(error: { code: string; message: string; fields?: Record<string, string[]> }) {
  const messages: Record<string, string> = {
    VALIDATION_ERROR: "Some details need attention. Check the highlighted fields.",
    UNAUTHENTICATED: "Your session has ended. Sign in again, then try once more.",
    UNREACHABLE: "We couldn't reach NextNode, so nothing was saved. Check your connection and try again.",
    BAD_RESPONSE: "We couldn't reach NextNode, so nothing was saved. Check your connection and try again.",
  };
  return {
    message: messages[error.code] ?? (error.message || "Something went wrong, so nothing was saved. Try again."),
    fields: fieldErrorsFromApi(error.fields),
  };
}
