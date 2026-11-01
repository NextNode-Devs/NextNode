import { parseBudget, PROJECT_LIMITS } from "@/entities/project";
import { OFFER_LIMITS, type Offer, type OfferBody } from "@/entities/start-gate";
import { formatMoney } from "@/shared/lib/format-money";

/** The offer form as typed. The total is dollars as text; it is sent as whole cents. */
export type OfferDraft = {
  summary: string;
  total: string;
  start_date: string; // yyyy-mm-dd
  delivery_date: string;
};

/** Keyed by the API's own field names, so its errors land on the right field. */
export type OfferErrors = Partial<Record<keyof OfferBody, string>>;

export const EMPTY_OFFER: OfferDraft = {
  summary: "",
  total: "",
  start_date: "",
  delivery_date: "",
};

/** A revision starts from the version the client declined, so the Lead changes only what they negotiated. */
export function draftFromOffer(offer: Offer | undefined): OfferDraft {
  if (!offer) return EMPTY_OFFER;
  return {
    summary: offer.summary,
    total: (offer.total_cents / 100).toFixed(2),
    start_date: offer.start_date,
    delivery_date: offer.delivery_date,
  };
}

const SUMMARY_MAX_TEXT = String(OFFER_LIMITS.summary).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Quick feedback only; the backend checks the same rules and is the authority. */
export function validateOffer(draft: OfferDraft, today: string): OfferErrors {
  const errors: OfferErrors = {};
  const summary = draft.summary.trim();
  if (summary.length < OFFER_LIMITS.summaryMin || summary.length > OFFER_LIMITS.summary) {
    errors.summary = `Use ${OFFER_LIMITS.summaryMin} to ${SUMMARY_MAX_TEXT} characters.`;
  }
  const cents = parseBudget(draft.total);
  if (draft.total.trim() === "") errors.total_cents = "Enter the offer total.";
  else if (cents === null) errors.total_cents = "Enter an amount in dollars, e.g. 10000 or 10,000.00.";
  else if (cents < PROJECT_LIMITS.minBudgetCents) {
    errors.total_cents = `Must be at least ${formatMoney(PROJECT_LIMITS.minBudgetCents, "cad")}.`;
  } else if (cents > PROJECT_LIMITS.maxBudgetCents) {
    errors.total_cents = `Must be at most ${formatMoney(PROJECT_LIMITS.maxBudgetCents, "cad")}.`;
  }
  if (!ISO_DAY.test(draft.start_date)) errors.start_date = "Choose a start date.";
  else if (draft.start_date < today) errors.start_date = "Choose today or a later date.";
  if (!ISO_DAY.test(draft.delivery_date)) errors.delivery_date = "Choose a delivery date.";
  else if (ISO_DAY.test(draft.start_date) && draft.delivery_date <= draft.start_date) {
    errors.delivery_date = "Choose a date after the start date.";
  }
  return errors;
}

export function toOfferBody(draft: OfferDraft): OfferBody {
  return {
    summary: draft.summary.trim(),
    total_cents: parseBudget(draft.total) ?? 0,
    start_date: draft.start_date,
    delivery_date: draft.delivery_date,
  };
}

/** The API's field errors (first message each), onto the form's fields. */
export function offerErrorsFromApi(fields: Record<string, string[]> | undefined): OfferErrors {
  const errors: OfferErrors = {};
  for (const key of ["summary", "total_cents", "start_date", "delivery_date"] as const) {
    const message = fields?.[key]?.[0];
    if (message) errors[key] = message;
  }
  return errors;
}
