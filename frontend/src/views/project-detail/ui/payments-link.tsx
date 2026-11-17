import { WalletIcon } from "lucide-react";
import Link from "next/link";

import type { Project } from "@/entities/project";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * Phase 2 prototype entry point (#96): the planned milestone payments page.
 * Client projects only, for the client, the Team Lead and members. It sits
 * beside the Phase 1 sections and changes none of them.
 */
export function PaymentsLink({ project }: { project: Project }) {
  const { is_owner, is_lead, is_member } = project.viewer;
  if (project.kind !== "client" || !(is_owner || is_lead || is_member)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Payments</h2>
          <PrototypeBadge label="Planned" />
        </CardTitle>
        <CardDescription>
          {is_owner ? "Milestone payments, what's held, and your receipts." : "What the client has paid and what's held."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/projects/${project.id}/payments`}>
            <WalletIcon aria-hidden data-icon="inline-start" />
            View payments
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
