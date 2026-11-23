/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-38). Only prototype screens may import
 * this; never a Phase 1 screen. One sample client team, seen in each situation
 * the replacement flow covers. Fixed dates keep server and browser renders equal.
 */
import type { LeadProposal, ReplacementCandidate, TeamChange, TeamChangesSnapshot, TeamSeat, TeamSituation } from "./replacement";

const AS_OF = "2026-11-21T15:00:00Z";

const seat = (account_id: number, display_name: string, role: TeamSeat["role"], skills: string[]): TeamSeat => ({
  account_id,
  display_name,
  role,
  state: "active",
  skills,
  joined_at: "2026-11-02T14:00:00Z",
  ended_at: null,
});

const TEAM: TeamSeat[] = [
  seat(9101, "Ada Okafor (sample)", "lead", ["React", "Django", "PostgreSQL"]),
  seat(9102, "Marco Ruiz (sample)", "member", ["React", "TypeScript"]),
  seat(9103, "Priya Nair (sample)", "member", ["Django", "REST APIs"]),
  seat(9104, "Liam Chen (sample)", "member", ["UI design", "Figma"]),
  seat(9105, "Sofia Alves (sample)", "member", ["Testing", "Playwright"]),
];

const JOINED: TeamChange[] = [
  { id: 1, kind: "joined", at: "2026-11-02T14:00:00Z", text: "The team of 5 was complete and work started." },
];

const CANDIDATES: ReplacementCandidate[] = [
  {
    account_id: 9201,
    display_name: "Noah Patel (sample)",
    source: "applicant",
    headline: "Backend developer, Django and APIs",
    skills: ["Django", "REST APIs", "PostgreSQL"],
    at: "2026-11-20T16:30:00Z",
  },
  {
    account_id: 9202,
    display_name: "Emma Kowalski (sample)",
    source: "applicant",
    headline: "Full-stack developer",
    skills: ["React", "Django"],
    at: "2026-11-20T19:10:00Z",
  },
  {
    account_id: 9203,
    display_name: "Yusuf Haddad (sample)",
    source: "invited",
    headline: "Python developer, new talent",
    skills: ["Python", "Django"],
    at: "2026-11-21T13:00:00Z",
  },
];

const PROPOSAL: LeadProposal = {
  candidate: { account_id: 9102, display_name: "Marco Ruiz (sample)" },
  proposed_by: "Sofia Alves (sample)",
  proposed_at: "2026-11-21T10:15:00Z",
  client_decision: "pending",
  offer_version: 3,
};

const QUIET: TeamChange = {
  id: 3,
  kind: "lead_quiet",
  at: "2026-11-20T18:00:00Z",
  text: "Ada Okafor (sample) hasn't written in the project for 3 days. The team and the client were told.",
};

const SNAPSHOTS: Record<TeamSituation, TeamChangesSnapshot> = {
  steady: {
    situation: "steady",
    as_of: AS_OF,
    team_size: 5,
    seats: TEAM,
    candidates: [],
    lead_last_active_at: "2026-11-21T12:40:00Z",
    proposal: null,
    history: JOINED,
  },
  member_left: {
    situation: "member_left",
    as_of: AS_OF,
    team_size: 5,
    seats: TEAM.map((s) => (s.account_id === 9103 ? { ...s, state: "left", ended_at: "2026-11-20T15:05:00Z" } : s)),
    candidates: CANDIDATES,
    lead_last_active_at: "2026-11-21T12:40:00Z",
    proposal: null,
    history: [
      ...JOINED,
      {
        id: 2,
        kind: "left",
        at: "2026-11-20T15:05:00Z",
        text: "Priya Nair (sample) left the team and lost access straight away. Their work and files stay with the project. Everyone was notified and the client was told.",
      },
    ],
  },
  lead_unresponsive: {
    situation: "lead_unresponsive",
    as_of: AS_OF,
    team_size: 5,
    seats: TEAM,
    candidates: [],
    lead_last_active_at: "2026-11-17T18:00:00Z",
    proposal: null,
    history: [...JOINED, QUIET],
  },
  lead_proposed: {
    situation: "lead_proposed",
    as_of: AS_OF,
    team_size: 5,
    seats: TEAM,
    candidates: [],
    lead_last_active_at: "2026-11-17T18:00:00Z",
    proposal: PROPOSAL,
    history: [
      ...JOINED,
      QUIET,
      {
        id: 4,
        kind: "lead_proposed",
        at: PROPOSAL.proposed_at,
        text: "Sofia Alves (sample) proposed Marco Ruiz (sample) as the new Lead. The client was asked to approve.",
      },
    ],
  },
};

export const SAMPLE_TEAM_SITUATIONS: TeamSituation[] = ["steady", "member_left", "lead_unresponsive", "lead_proposed"];

export function sampleTeamChanges(situation: TeamSituation): TeamChangesSnapshot {
  return SNAPSHOTS[situation];
}
