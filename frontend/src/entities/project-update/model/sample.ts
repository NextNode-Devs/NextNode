/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #92). Only prototype screens may import
 * this; never a Phase 1 screen. Replace with the API once ProjectUpdate
 * exists. Milestone numbers match `SAMPLE_MILESTONES` (entities/milestone).
 * Fixed dates and ids keep server and browser renders identical.
 */
import type { ProjectUpdate } from "./project-update";

const PROJECT_ID = 9001;
const ADA = { account_id: 1, display_name: "Ada", role: "lead" as const };
const LINUS = { account_id: 2, display_name: "Linus", role: "member" as const };
const MARGARET = { account_id: 3, display_name: "Margaret", role: "member" as const };
const GRACE = { account_id: 10, display_name: "Grace", role: "client" as const };

export const SAMPLE_PROJECT_UPDATES: ProjectUpdate[] = [
  {
    id: 7,
    project_id: PROJECT_ID,
    author: ADA,
    body: "Milestone 2 is submitted for review. The booking flow is on staging; the link is under Meetings for Friday's demo.",
    created_at: "2026-12-17T21:45:00Z",
    milestone_sequence: 2,
  },
  {
    id: 6,
    project_id: PROJECT_ID,
    author: MARGARET,
    body: "Sign-up, sign-in and password reset are merged and ready to test.",
    created_at: "2026-12-12T18:10:00Z",
    milestone_sequence: 2,
  },
  {
    id: 5,
    project_id: PROJECT_ID,
    author: GRACE,
    body: "Approved milestone 1. The designs look great, thank you all.",
    created_at: "2026-12-04T14:10:00Z",
    milestone_sequence: 1,
  },
  {
    id: 4,
    project_id: PROJECT_ID,
    author: LINUS,
    body: "Staging is live and CI runs on every pull request.",
    created_at: "2026-11-28T20:30:00Z",
    milestone_sequence: 1,
  },
  {
    id: 3,
    project_id: PROJECT_ID,
    author: ADA,
    body: "First screen designs are in the Documents tab for feedback.",
    created_at: "2026-11-24T16:00:00Z",
    milestone_sequence: 1,
  },
  {
    id: 2,
    project_id: PROJECT_ID,
    author: ADA,
    body: "Welcome, everyone. Stand-ups are Mondays and Thursdays at 10:00; the link is under Meetings.",
    created_at: "2026-11-09T15:00:00Z",
    milestone_sequence: null,
  },
];
