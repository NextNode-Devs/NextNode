export {
  applyToLead,
  decideLeadCandidacy,
  getLeadCandidacy,
  getMyLeadCandidacies,
  getProjectLeadChats,
  inviteToLead,
  type LeadDecision,
} from "./api/lead-candidacy-api";
export {
  LEAD_STATUS_TAG,
  leadChatHref,
  leadStatusText,
  type LeadActions,
  type LeadCandidacy,
  type LeadChat,
  type LeadStatus,
  type MyLeadCandidacy,
} from "./model/lead-candidacy";

/** Socket frame sent to both people after any Hire Lead decision. */
export const LEAD_UPDATED = "lead.updated";
