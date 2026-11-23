import { SAMPLE_PROJECT_UPDATES } from "@/entities/project-update";
import type { ApiResult } from "@/shared/api/types";
import { LoadError } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import type { OverviewData } from "../model/overview";
import { InboxTabs } from "./inbox-tabs";
import { RoleOverview } from "./role-overview";

type Props = {
  accountRole: "developer" | "client";
  result: ApiResult<OverviewData>;
};

/**
 * PROTOTYPE (NN-32 #88): the unified dashboard v2, below the Phase 1 sections
 * and separate from them. Every project with the viewer's role, a role filter,
 * needs attention, the latest update per project, and conversation tabs with
 * unread counts. Sample data until `GET /api/dashboard/` exists.
 */
export function DashboardOverview({ accountRole, result }: Props) {
  return (
    <section aria-labelledby="dashboard-v2-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="dashboard-v2-title" className="text-xl font-semibold tracking-tight">
          Everything in one place
        </h2>
        <PrototypeBadge />
      </div>
      <PrototypeNotice title="Prototype: unified dashboard">
        These projects, messages and updates are sample data, not your account&apos;s. Your real projects and
        conversations are in the sections above. Buttons here are under construction.
      </PrototypeNotice>
      {result.ok ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <h3>Your projects</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RoleOverview projects={result.data.projects} attention={result.data.attention} updates={SAMPLE_PROJECT_UPDATES} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <h3>Messages</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InboxTabs items={result.data.inbox} accountRole={accountRole} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadError title="We couldn't load your dashboard overview" message={result.error.message} />
      )}
    </section>
  );
}
