"use client";

import { CalendarIcon, LockKeyholeIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  availableActions,
  MilestoneStatusBadge,
  revisionCount,
  type Milestone,
  type MilestoneAction,
  type MilestoneReview,
  type MilestoneViewer,
} from "@/entities/milestone";
import { ApproveMilestoneButton, RequestRevisionButton } from "@/features/review-milestone";
import { SubmitMilestoneButton } from "@/features/submit-milestone";
import { formatCalendarDate } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardHeader } from "@/shared/ui/shadcn/card";

import { nextStepText } from "../model/next-step";
import { ReviewHistory } from "./review-history";

type Props = {
  milestone: Milestone;
  /** This milestone's history, oldest first. */
  reviews: MilestoneReview[];
  viewer: MilestoneViewer;
  releasesDeposit: boolean;
  onAction: (milestone: Milestone, action: MilestoneAction, note: string, link: string | null) => void;
  /** Move focus to this card's heading (after an action removed the button that had it). */
  focusRequest: number;
};

/** One milestone: its state, what happens next, the viewer's actions and its review history. */
export function MilestoneCard({ milestone, reviews, viewer, releasesDeposit, onAction, focusRequest }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actions = availableActions(milestone.status, viewer);
  const revisions = revisionCount(reviews, milestone.id);
  const headingId = `milestone-${milestone.id}-title`;
  const openHistory = milestone.status === "under_review" || (milestone.status === "in_progress" && reviews.length > 0);

  useEffect(() => {
    if (!focusRequest) return;
    // Wait until the dialog has closed and given focus back, then take it.
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (!document.querySelector('[role="dialog"]') || tries > 40) {
        window.clearInterval(timer);
        headingRef.current?.focus();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [focusRequest]);

  return (
    <Card aria-labelledby={headingId} role="article">
      <CardHeader className="gap-2">
        <p className="text-xs font-medium text-muted-foreground">Milestone {milestone.sequence}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="mr-1 rounded-sm text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {milestone.title}
          </h3>
          <MilestoneStatusBadge status={milestone.status} />
          {revisions > 0 ? (
            <Badge variant="outline">{revisions === 1 ? "Revised once" : `Revised ${revisions} times`}</Badge>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon aria-hidden className="size-4" />
            Due {formatCalendarDate(milestone.due_date)}
          </span>
          {releasesDeposit ? (
            <span className="inline-flex items-center gap-1.5">
              <LockKeyholeIcon aria-hidden className="size-4" />
              Releases the deposit
              <PrototypeBadge label="Planned" />
            </span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestone.description ? <p className="text-sm">{milestone.description}</p> : null}
        <p className="text-sm text-muted-foreground" data-testid="next-step">
          {nextStepText(milestone.status, viewer)}
        </p>
        {actions.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {actions.includes("submit") ? (
              <SubmitMilestoneButton
                milestone={milestone}
                resubmission={revisions > 0}
                onSubmit={(note, link) => onAction(milestone, "submit", note, link)}
              />
            ) : null}
            {actions.includes("approve") ? (
              <ApproveMilestoneButton
                milestone={milestone}
                releasesDeposit={releasesDeposit}
                onApprove={() => onAction(milestone, "approve", "", null)}
              />
            ) : null}
            {actions.includes("request_revision") ? (
              <RequestRevisionButton
                milestone={milestone}
                onRequest={(note) => onAction(milestone, "request_revision", note, null)}
              />
            ) : null}
          </div>
        ) : null}
        {reviews.length > 0 ? (
          <details open={openHistory} className="group">
            <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Review history ({reviews.length})
            </summary>
            <div className="mt-3">
              <ReviewHistory reviews={reviews} />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
