export {
  isDepositReleaseChoice,
  MILESTONE_RULES,
  MILESTONE_STATUS_LABEL,
  milestoneScheduleProblems,
  milestonesTotalCents,
  type DepositReleaseChoice,
  type Milestone,
  type MilestonePlan,
  type MilestoneStatus,
} from "./model/milestone";
export {
  applyMilestoneAction,
  availableActions,
  milestoneViewer,
  reviewLinkProblem,
  reviewNoteProblem,
  reviewsFor,
  revisionCount,
  REVIEW_KIND_LABEL,
  REVIEW_RULES,
  startNextMilestone,
  type MilestoneAction,
  type MilestoneReview,
  type MilestoneReviewKind,
  type MilestoneViewer,
  type TransitionInput,
  type TransitionResult,
} from "./model/review";
// Prototype sample data: import only from Phase 2 prototype screens.
export {
  MILESTONE_SAMPLE_SITUATIONS,
  SAMPLE_MILESTONE_PLAN,
  SAMPLE_MILESTONE_REVIEWS,
  SAMPLE_MILESTONES,
  sampleMilestoneSituation,
  type MilestoneSample,
  type MilestoneSampleSituation,
} from "./model/sample";
export { MilestoneStatusBadge } from "./ui/milestone-status-badge";
