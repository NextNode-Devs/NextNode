import type { LeadChat } from "@/entities/lead-candidacy";

/** True when the developer can't apply again: an application or invitation is
 * still open, or they applied before (an application is allowed once). */
export function alreadyInvolved(mine: LeadChat[]): boolean {
  return mine.some(
    (c) => c.kind === "application" || c.status === "invited" || c.status === "candidate" || c.status === "hired",
  );
}
