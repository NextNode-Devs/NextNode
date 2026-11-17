import { FlaskConicalIcon } from "lucide-react";

import { Badge } from "@/shared/ui/shadcn/badge";

type Props = {
  /** "Prototype" (default) or "Planned" for flows the live product does not do yet (payments). */
  label?: "Prototype" | "Planned";
  className?: string;
};

/**
 * Marks a Phase 2 prototype screen or section (NN-31). Every screen or
 * section that shows sample data or placeholder actions carries one.
 */
export function PrototypeBadge({ label = "Prototype", className }: Props) {
  return (
    <Badge variant="outline" className={className}>
      <FlaskConicalIcon aria-hidden data-icon="inline-start" />
      {label}
    </Badge>
  );
}
