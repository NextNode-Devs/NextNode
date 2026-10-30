export {
  applyToLead,
  decideLeadCandidacy,
  getLeadCandidacy,
  type LeadDecision,
} from "./api/lead-candidacy-api";
export {
  leadStatusText,
  type LeadActions,
  type LeadCandidacy,
  type LeadStatus,
} from "./model/lead-candidacy";

/** Socket frame sent to both people after any Hire Lead decision. */
export const LEAD_UPDATED = "lead.updated";
