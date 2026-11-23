import { describe, expect, it } from "vitest";

import type { Milestone } from "./milestone";
import {
  applyMilestoneAction,
  availableActions,
  milestoneViewer,
  reviewLinkProblem,
  revisionCount,
  reviewsFor,
  startNextMilestone,
  type TransitionInput,
} from "./review";
import { SAMPLE_MILESTONE_REVIEWS, SAMPLE_MILESTONES, sampleMilestoneSituation } from "./sample";

const milestone = (status: Milestone["status"], overrides: Partial<Milestone> = {}): Milestone => ({
  ...SAMPLE_MILESTONES[1],
  status,
  submitted_at: null,
  approved_at: null,
  ...overrides,
});

const input = (overrides: Partial<TransitionInput>): TransitionInput => ({
  action: "submit",
  viewer: "lead",
  note: "Ready on staging.",
  author_name: "Ada",
  at: "2026-12-20T10:00:00Z",
  review_id: 900,
  ...overrides,
});

describe("milestoneViewer", () => {
  it("picks the client first, then the Lead, then a member; nobody else", () => {
    expect(milestoneViewer({ is_owner: true, is_lead: false, is_member: false })).toBe("client");
    expect(milestoneViewer({ is_owner: false, is_lead: true, is_member: true })).toBe("lead");
    expect(milestoneViewer({ is_owner: false, is_lead: false, is_member: true })).toBe("member");
    expect(milestoneViewer({ is_owner: false, is_lead: false, is_member: false })).toBeNull();
  });
});

describe("availableActions", () => {
  it("lets the Lead submit only work in progress", () => {
    expect(availableActions("in_progress", "lead")).toEqual(["submit"]);
    expect(availableActions("under_review", "lead")).toEqual([]);
    expect(availableActions("pending_deposit", "lead")).toEqual([]);
  });

  it("lets the client approve or send back only work under review", () => {
    expect(availableActions("under_review", "client")).toEqual(["approve", "request_revision"]);
    expect(availableActions("in_progress", "client")).toEqual([]);
    expect(availableActions("completed", "client")).toEqual([]);
  });

  it("gives members no actions", () => {
    for (const status of ["pending_deposit", "not_started", "in_progress", "under_review", "completed"] as const) {
      expect(availableActions(status, "member")).toEqual([]);
    }
  });
});

describe("applyMilestoneAction: the review loop", () => {
  it("submit → under review, recording when and the Lead's note and link", () => {
    const result = applyMilestoneAction(milestone("in_progress"), input({ link_url: " https://staging.example.com " }));
    expect(result).toMatchObject({
      ok: true,
      milestone: { status: "under_review", submitted_at: "2026-12-20T10:00:00Z" },
      review: { kind: "submitted", note: "Ready on staging.", link_url: "https://staging.example.com", author_role: "lead" },
    });
  });

  it("request revision → back in progress, keeping the client's note", () => {
    const result = applyMilestoneAction(
      milestone("under_review"),
      input({ action: "request_revision", viewer: "client", note: "  Fix the email. ", author_name: "Grace" }),
    );
    expect(result).toMatchObject({
      ok: true,
      milestone: { status: "in_progress", approved_at: null },
      review: { kind: "revision_requested", note: "Fix the email.", link_url: null, author_role: "client" },
    });
  });

  it("approve → completed, with no note needed", () => {
    const result = applyMilestoneAction(milestone("under_review"), input({ action: "approve", viewer: "client", note: "" }));
    expect(result).toMatchObject({ ok: true, milestone: { status: "completed", approved_at: "2026-12-20T10:00:00Z" } });
  });

  it("goes round the loop until approved", () => {
    let current = milestone("in_progress");
    const steps: TransitionInput[] = [
      input({}),
      input({ action: "request_revision", viewer: "client", note: "Change X." }),
      input({}),
      input({ action: "approve", viewer: "client", note: "" }),
    ];
    const statuses = steps.map((step) => {
      const result = applyMilestoneAction(current, step);
      if (!result.ok) throw new Error(result.reason);
      current = result.milestone;
      return current.status;
    });
    expect(statuses).toEqual(["under_review", "in_progress", "under_review", "completed"]);
  });

  it("refuses the wrong person, the wrong state, a missing note and a bad link", () => {
    expect(applyMilestoneAction(milestone("in_progress"), input({ viewer: "client" }))).toEqual({
      ok: false,
      reason: "Only the Team Lead submits milestone work.",
    });
    expect(applyMilestoneAction(milestone("under_review"), input({ action: "approve", viewer: "member" }))).toEqual({
      ok: false,
      reason: "Only the client reviews milestone work.",
    });
    expect(applyMilestoneAction(milestone("pending_deposit"), input({}))).toMatchObject({ ok: false });
    expect(applyMilestoneAction(milestone("completed"), input({ action: "approve", viewer: "client" }))).toMatchObject({
      ok: false,
    });
    expect(applyMilestoneAction(milestone("in_progress"), input({ note: "   " }))).toEqual({
      ok: false,
      reason: "Say what is ready for the client to review.",
    });
    expect(
      applyMilestoneAction(milestone("under_review"), input({ action: "request_revision", viewer: "client", note: "" })),
    ).toEqual({ ok: false, reason: "Say what needs to change." });
    expect(applyMilestoneAction(milestone("in_progress"), input({ link_url: "http://plain.example.com" }))).toMatchObject({
      ok: false,
    });
  });
});

describe("reviewLinkProblem", () => {
  it("accepts nothing or an https link", () => {
    expect(reviewLinkProblem("")).toBeNull();
    expect(reviewLinkProblem(null)).toBeNull();
    expect(reviewLinkProblem("https://github.com/org/repo/pull/1")).toBeNull();
    expect(reviewLinkProblem("staging.example.com")).toBe("Enter a full link, such as https://staging.example.com.");
    expect(reviewLinkProblem("http://example.com")).toBe("Use a link that starts with https://.");
  });
});

describe("startNextMilestone", () => {
  it("starts the first milestone not started once nothing else is open", () => {
    const after = startNextMilestone(sampleMilestoneSituation("under_review").milestones.map((m) =>
      m.sequence === 2 ? { ...m, status: "completed" as const } : m,
    ));
    expect(after.map((m) => m.status)).toEqual(["completed", "completed", "in_progress", "not_started"]);
  });

  it("changes nothing while a milestone is still open", () => {
    const before = sampleMilestoneSituation("under_review").milestones;
    expect(startNextMilestone(before).map((m) => m.status)).toEqual(before.map((m) => m.status));
  });
});

describe("history helpers and sample data", () => {
  it("counts revisions and orders history oldest first", () => {
    expect(revisionCount(SAMPLE_MILESTONE_REVIEWS, 1)).toBe(1);
    expect(revisionCount(SAMPLE_MILESTONE_REVIEWS, 3)).toBe(0);
    expect(reviewsFor(SAMPLE_MILESTONE_REVIEWS, 2).map((r) => r.kind)).toEqual([
      "submitted",
      "revision_requested",
      "submitted",
    ]);
  });

  it("keeps each sample situation consistent with its history", () => {
    for (const situation of ["awaiting_deposit", "revision_requested", "under_review", "all_completed"] as const) {
      const { milestones, reviews } = sampleMilestoneSituation(situation);
      for (const m of milestones) {
        const last = reviewsFor(reviews, m.id).at(-1);
        const expected =
          m.status === "completed" ? "approved" : m.status === "under_review" ? "submitted" : m.status === "in_progress" ? "revision_requested" : undefined;
        expect(last?.kind, `${situation}, milestone ${m.sequence}`).toBe(expected);
      }
    }
    expect(sampleMilestoneSituation("no_milestones").milestones).toEqual([]);
  });
});
