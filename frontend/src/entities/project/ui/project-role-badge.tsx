import { Badge } from "@/shared/ui/shadcn/badge";

import { PROJECT_ROLE_LABEL, type ProjectRole } from "../model/dashboard";

/** The viewer's role on one project (NN-32), in words. Team Lead stands out. */
export function ProjectRoleBadge({ role }: { role: ProjectRole }) {
  return <Badge variant={role === "lead" ? "default" : "secondary"}>{PROJECT_ROLE_LABEL[role]}</Badge>;
}
