import type { MyLeadCandidacy } from "@/entities/lead-candidacy";

export type Show = "all" | "application" | "invitation";

const ORDER: Record<MyLeadCandidacy["status"], number> = {
  invited: 0,
  candidate: 0,
  hired: 1,
  declined: 2,
  withdrawn: 2,
  closed: 2,
};

/** The items a card shows: open ones first (newest first within each group, as the API sends them). */
export function pickFor(items: MyLeadCandidacy[], show: Show): MyLeadCandidacy[] {
  const shown = show === "all" ? items : items.filter((item) => item.kind === show);
  return [...shown].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
