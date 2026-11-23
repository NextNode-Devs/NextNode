import { ArchiveIcon, BadgeCheckIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * Phase 2 prototype entry point (NN-17 #97): final approval and the archived
 * view. Client projects only, for the client, the Team Lead and members. It
 * sits beside the Phase 1 sections and changes none of them.
 */
export function FinishLink({ project }: { project: Project }) {
  const { is_owner, is_lead, is_member } = project.viewer;
  if (project.kind !== "client" || !(is_owner || is_lead || is_member)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Finishing the project</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>
          {is_owner
            ? "Approve the finished project, pay the final payment, and see it archived."
            : "The client's final approval, and the project once it's archived."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/projects/${project.id}/final-approval`}>
            <BadgeCheckIcon aria-hidden data-icon="inline-start" />
            Final approval
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/projects/${project.id}/archived`}>
            <ArchiveIcon aria-hidden data-icon="inline-start" />
            Archived view
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
