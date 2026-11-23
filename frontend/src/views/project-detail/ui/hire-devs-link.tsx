import { UserSearchIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * Phase 2 prototype entry point (#91): Hire Devs with match scores. Only the
 * Team Lead of a team that is still recruiting sees it. It sits beside the
 * Phase 1 team roster and changes none of it.
 */
export function HireDevsLink({ project }: { project: Project }) {
  const { team } = project;
  const recruiting = team.status === "open" && (team.size === null || team.open_spots > 0);
  if (!project.viewer.is_lead || !recruiting) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Hire developers</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>Developers ranked by how well they match your tech stack, and why.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/projects/${project.id}/hire-devs`}>
            <UserSearchIcon aria-hidden data-icon="inline-start" />
            See matched developers
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
