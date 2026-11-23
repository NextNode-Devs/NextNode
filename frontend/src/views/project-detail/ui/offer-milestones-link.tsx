import { ListChecksIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * Phase 2 prototype entry point (NN-16a #94): the milestones on the offer.
 * Client projects only, for the client, the Team Lead and members. It sits
 * beside the Phase 1 offer and changes nothing in it.
 */
export function OfferMilestonesLink({ project }: { project: Project }) {
  const { is_owner, is_lead, is_member } = project.viewer;
  if (project.kind !== "client" || !(is_owner || is_lead || is_member)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Offer milestones</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>
          {is_lead
            ? "Split your offer into milestones and set the deposit."
            : is_owner
              ? "Review the milestones and choose which one releases your deposit."
              : "The milestones in this project's offer."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/projects/${project.id}/offer-milestones`}>
            <ListChecksIcon aria-hidden data-icon="inline-start" />
            {is_lead ? "Plan milestones" : "View milestones"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
