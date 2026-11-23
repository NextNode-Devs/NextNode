import { Badge } from "@/shared/ui/shadcn/badge";

import { STATUS_TAG, type InviteLinkStatus } from "../model/invite-link";

/** "Active", "Expired" or "Used", in words (never colour alone). */
export function InviteLinkStatusBadge({ status }: { status: InviteLinkStatus }) {
  return (
    <Badge
      variant={status === "active" ? "outline" : "secondary"}
      className={status === "active" ? "border-success/40 text-success" : undefined}
    >
      {STATUS_TAG[status]}
    </Badge>
  );
}
