import { SparklesIcon } from "lucide-react";

import { Badge } from "@/shared/ui/shadcn/badge";

/**
 * "New talent" on developer cards and profiles (Phase 2, #102). Used by the
 * directory and Hire Devs cards and junior spots, so it looks the same everywhere.
 */
export function NewTalentBadge() {
  return (
    <Badge variant="outline">
      <SparklesIcon aria-hidden data-icon="inline-start" />
      New talent
    </Badge>
  );
}
