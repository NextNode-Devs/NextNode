/**
 * Milestone delivery and review (Phase 2, NN-16b #95; stakeholder Q1).
 *
 * The Team Lead submits a milestone's work, the client approves it or asks
 * for a revision, and the loop repeats until it is approved:
 *
 *   Pending deposit → In progress → Under review → Completed
 *                          ↑              │
 *                          └── revision ──┘
 *
 * PROTOTYPE: there is no milestone API yet. These are the planned API shapes
 * and the transitions the backend will own as domain methods (backlog
 * NN-16b, "Backend note"). Every transition also writes one review event, so
 * the history is the audit trail of the loop.
 */
import type { Milestone, MilestoneStatus } from "./milestone";

/** Who is looking at a milestone. People outside the project never see one. */
export type MilestoneViewer = "client" | "lead" | "member";

export type MilestoneReviewKind = "submitted" | "revision_requested" | "approved";

/** One step of a milestone's review history (planned `GET /projects/:id/milestones/:id/reviews`). */
export type MilestoneReview = {
  id: number;
  milestone_id: number;
  kind: MilestoneReviewKind;
  /** The Lead's summary of the work, or the client's requested changes; empty on a plain approval. */
  note: string;
  /** Where the client can see the work (staging site, pull request, demo video); optional. */
  link_url: string | null;
  author_name: string;
  author_role: "client" | "lead";
  /** ISO timestamp. */
  created_at: string;
};

export type MilestoneAction = "submit" | "approve" | "request_revision";

export const REVIEW_RULES = {
  noteMax: 2000,
  /** The Lead says what is ready; the client says what to change. An approval needs no words. */
  noteRequired: { submit: true, request_revision: true, approve: false } satisfies Record<MilestoneAction, boolean>,
} as const;

export const REVIEW_KIND_LABEL: Record<MilestoneReviewKind, string> = {
  submitted: "Submitted for review",
  revision_requested: "Revision requested",
  approved: "Approved",
};

export function milestoneViewer(viewer: { is_owner: boolean; is_lead: boolean; is_member: boolean }): MilestoneViewer | null {
  if (viewer.is_owner) return "client";
  if (viewer.is_lead) return "lead";
  if (viewer.is_member) return "member";
  return null;
}

const ACTOR: Record<MilestoneAction, MilestoneViewer> = {
  submit: "lead",
  approve: "client",
  request_revision: "client",
};

const FROM: Record<MilestoneAction, MilestoneStatus> = {
  submit: "in_progress",
  approve: "under_review",
  request_revision: "under_review",
};

/** The actions this viewer can take on this milestone right now (empty for members). */
export function availableActions(status: MilestoneStatus, viewer: MilestoneViewer): MilestoneAction[] {
  return (Object.keys(ACTOR) as MilestoneAction[]).filter((action) => ACTOR[action] === viewer && FROM[action] === status);
}

export type TransitionInput = {
  action: MilestoneAction;
  viewer: MilestoneViewer;
  note: string;
  link_url?: string | null;
  author_name: string;
  at: string;
  /** Id for the new review event. */
  review_id: number;
};

export type TransitionResult =
  | { ok: true; milestone: Milestone; review: MilestoneReview }
  | { ok: false; reason: string };

/** Why a note cannot be sent, in plain words; `null` when it can. */
export function reviewNoteProblem(action: MilestoneAction, note: string): string | null {
  const text = note.trim();
  if (REVIEW_RULES.noteRequired[action] && !text) {
    return action === "submit" ? "Say what is ready for the client to review." : "Say what needs to change.";
  }
  if (text.length > REVIEW_RULES.noteMax) return `Keep it under ${REVIEW_RULES.noteMax} characters.`;
  return null;
}

/** Why a link cannot be sent; `null` when it is empty or a valid https link. */
export function reviewLinkProblem(link: string | null | undefined): string | null {
  const value = link?.trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? null : "Use a link that starts with https://.";
  } catch {
    return "Enter a full link, such as https://staging.example.com.";
  }
}

/**
 * Applies one step of the review loop. Pure: returns the milestone's next
 * state and the history event, or why the step is not allowed. The backend
 * will enforce the same rules (`Milestone.submit()`, `.approve()`,
 * `.request_revision()`).
 */
export function applyMilestoneAction(milestone: Milestone, input: TransitionInput): TransitionResult {
  const { action, viewer } = input;
  if (ACTOR[action] !== viewer) {
    return {
      ok: false,
      reason: action === "submit" ? "Only the Team Lead submits milestone work." : "Only the client reviews milestone work.",
    };
  }
  if (milestone.status !== FROM[action]) {
    return {
      ok: false,
      reason:
        action === "submit"
          ? "Only a milestone in progress can be submitted."
          : "Only a milestone under review can be approved or sent back.",
    };
  }
  const noteProblem = reviewNoteProblem(action, input.note);
  if (noteProblem) return { ok: false, reason: noteProblem };
  const link = action === "submit" ? input.link_url?.trim() || null : null;
  const linkProblem = reviewLinkProblem(link);
  if (linkProblem) return { ok: false, reason: linkProblem };

  const next: Milestone =
    action === "submit"
      ? { ...milestone, status: "under_review", submitted_at: input.at }
      : action === "approve"
        ? { ...milestone, status: "completed", approved_at: input.at }
        : { ...milestone, status: "in_progress" };

  const review: MilestoneReview = {
    id: input.review_id,
    milestone_id: milestone.id,
    kind: action === "submit" ? "submitted" : action === "approve" ? "approved" : "revision_requested",
    note: input.note.trim(),
    link_url: link,
    author_name: input.author_name,
    author_role: viewer === "client" ? "client" : "lead",
    created_at: input.at,
  };
  return { ok: true, milestone: next, review };
}

/**
 * After an approval, work moves on to the next milestone in order: the first
 * one not started yet becomes in progress. (Prototype assumption; see the
 * NN-16b backend note.)
 */
export function startNextMilestone(milestones: readonly Milestone[]): Milestone[] {
  const ordered = [...milestones].sort((a, b) => a.sequence - b.sequence);
  if (ordered.some((m) => m.status === "in_progress" || m.status === "under_review")) return ordered;
  const next = ordered.find((m) => m.status === "not_started");
  return ordered.map((m) => (m === next ? { ...m, status: "in_progress" } : m));
}

/** How many times the client has sent this milestone back. */
export function revisionCount(reviews: readonly MilestoneReview[], milestoneId: number): number {
  return reviews.filter((r) => r.milestone_id === milestoneId && r.kind === "revision_requested").length;
}

/** A milestone's history, oldest first. */
export function reviewsFor(reviews: readonly MilestoneReview[], milestoneId: number): MilestoneReview[] {
  return reviews.filter((r) => r.milestone_id === milestoneId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}
