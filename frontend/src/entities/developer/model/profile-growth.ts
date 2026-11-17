/**
 * PLANNED developer profile fields (Phase 2, NN-34 #102; stakeholder Q4).
 *
 * PROTOTYPE: the API does not return these yet. They are kept apart from
 * `Portfolio` and `DeveloperCard`, which mirror the working Phase 1 API, so no
 * live screen claims data the backend does not send. When the backend adds
 * them, they move into those types.
 *
 * Owner: Jayraj (#102) extends this. Used by the shared developer filters
 * (Isabella, #93), Hire Devs matching (Kaushalya and Hardik, #91) and junior
 * spots (Kai, #99).
 */

export type Certificate = {
  id: number;
  title: string;
  issuer: string;
  /** `YYYY-MM-DD`, or `null` if not given. */
  issued_on: string | null;
  file_name: string;
};

export type ProfileGrowth = {
  account_id: number;
  /** IANA time zone, e.g. `America/Toronto`; `null` until the developer sets it. */
  time_zone: string | null;
  /**
   * Marks a developer as new to NextNode, so Team Leads can filter for
   * newcomers. How it is set (self-declared, or automatic until a first
   * completed project) is Jayraj's call in #102; prototypes treat it as given.
   */
  is_new_talent: boolean;
  /** Shown "as provided", never "verified". */
  certificates: Certificate[];
};

/** Time zones offered in the profile form and the filters: Canada first, then common team locations. */
export const TIME_ZONE_OPTIONS = [
  { value: "America/St_Johns", label: "Newfoundland (St. John's)" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/Toronto", label: "Eastern (Toronto)" },
  { value: "America/Winnipeg", label: "Central (Winnipeg)" },
  { value: "America/Edmonton", label: "Mountain (Edmonton)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Berlin", label: "Central Europe (Berlin)" },
  { value: "Africa/Lagos", label: "West Africa (Lagos)" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Manila", label: "Philippines (Manila)" },
] as const;

export type TimeZoneValue = (typeof TIME_ZONE_OPTIONS)[number]["value"];

/** "Eastern (Toronto)" for a listed zone, the raw zone otherwise, "Not set" for none. */
export function timeZoneLabel(zone: string | null): string {
  if (!zone) return "Not set";
  return TIME_ZONE_OPTIONS.find((option) => option.value === zone)?.label ?? zone;
}
