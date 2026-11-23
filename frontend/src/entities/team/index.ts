export {
  applyToJoin,
  decideTeamCandidacy,
  getMyTeamCandidacies,
  getTeam,
  getTeamCandidacy,
  inviteDeveloper,
  setTeamSize,
  type TeamDecision,
} from "./api/team-api";
export {
  chooseAssistantLead,
  closeDeveloperProject,
  confirmProjectActive,
  getStewardship,
} from "./api/stewardship-api";
export { TEAM_UPDATED } from "./model/frames";
export {
  CANDIDACY_STATUS_TAG,
  candidacyHref,
  candidacyStatusText,
  TEAM_SIZES,
  type CandidacyActions,
  type CandidacyKind,
  type CandidacyStatus,
  type MyTeamCandidacy,
  type TeamCandidacy,
  type TeamMember,
  type TeamProfile,
} from "./model/team";
export {
  endedCheckText,
  type ActivityCheck,
  type ActivityCheckStatus,
  type AssistantLeadPermission,
  type Stewardship,
} from "./model/stewardship";
// Phase 2 prototype (NN-38): Lead and member replacement on client projects, not in the API yet.
export {
  activeSeats,
  daysBetween,
  isLeadUnresponsive,
  LEAD_UNRESPONSIVE_DAYS,
  openSpots,
  SEAT_STATE_LABEL,
  SITUATION_LABEL,
  teamViewer,
  type LeadProposal,
  type ReplacementCandidate,
  type SeatState,
  type TeamChange,
  type TeamChangeKind,
  type TeamChangesSnapshot,
  type TeamSeat,
  type TeamSituation,
  type TeamViewer,
} from "./model/replacement";
// Prototype sample data: import only from Phase 2 prototype screens.
export { SAMPLE_TEAM_SITUATIONS, sampleTeamChanges } from "./model/replacement-sample";
// Phase 2 prototype (NN-38, Aliya): the new Lead signs the current offer; access-lost screen.
export {
  replacementSignature,
  RESIGN_SITUATION_LABEL,
  resignViewer,
  type CurrentOffer,
  type LeadResignSnapshot,
  type LeadSignature,
  type ResignSituation,
  type ResignViewer,
} from "./model/lead-resign";
export {
  ACCESS_REMOVAL_LABEL,
  CLOSED_TO_FORMER_MEMBERS,
  isAccessRemovalReason,
  type AccessRemoval,
  type AccessRemovalReason,
} from "./model/access-removal";
// Prototype sample data: import only from Phase 2 prototype screens.
export {
  SAMPLE_ACCESS_REMOVAL_REASONS,
  SAMPLE_RESIGN_SITUATIONS,
  sampleAccessRemoval,
  sampleLeadResign,
} from "./model/lead-resign-sample";
export { TeamLiveRefresh } from "./ui/team-live-refresh";
// Phase 2 prototype (NN-36 #99): junior spots.
export {
  clampJunior,
  juniorCount,
  juniorSpotsLine,
  NEW_TALENT_DIRECTORY_HREF,
  newTalentHireDevsHref,
  spotsWithJunior,
  type OpenSpot,
  type SpotType,
} from "./model/spots";
// Prototype sample data: import only from Phase 2 prototype screens.
export { sampleJuniorCount } from "./model/sample";
