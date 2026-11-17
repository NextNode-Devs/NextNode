import { Badge } from "@/shared/ui/shadcn/badge";

import { MILESTONE_STATUS_LABEL, type MilestoneStatus } from "../model/milestone";

const VARIANT: Record<MilestoneStatus, "outline" | "secondary" | "default"> = {
  pending_deposit: "outline",
  not_started: "outline",
  in_progress: "secondary",
  under_review: "secondary",
  completed: "default",
};

/** A milestone's work status, in words (never colour alone). */
export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <Badge variant={VARIANT[status]}>{MILESTONE_STATUS_LABEL[status]}</Badge>;
}
