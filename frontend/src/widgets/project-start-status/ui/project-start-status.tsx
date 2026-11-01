import type { Project } from "@/entities/project";
import { getStartGate } from "@/entities/start-gate";
import { authedServerApi } from "@/shared/api/server-client";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { StartStatusCard } from "./start-status-card";

/**
 * What a project still needs before work starts, for its client, Team Lead and
 * members (#6). Anyone else gets nothing here: the server refuses them.
 */
export async function ProjectStartStatus({ project }: { project: Project }) {
  const result = await getStartGate(authedServerApi, project.id);
  if (result.ok) return <StartStatusCard gate={result.data} targetDeliveryDate={project.target_delivery_date} />;
  if (result.error.code === "FORBIDDEN" || result.error.code === "NOT_FOUND") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Project start</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p role="alert" className="text-destructive">
          We couldn&apos;t load what this project needs to start. {result.error.message}
        </p>
        <RefreshButton label="Try again" />
      </CardContent>
    </Card>
  );
}
