import { CircleCheckIcon, CircleXIcon, ShieldCheckIcon } from "lucide-react";

import { endedCheckText, type Stewardship } from "@/entities/team";
import { ChooseAssistantLead } from "@/features/choose-assistant-lead";
import { CloseProjectButton } from "@/features/close-developer-project";
import { ActivityCheckAlert } from "@/features/confirm-project-active";
import { formatMessageTime } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  projectId: number;
  isLead: boolean;
  stewardship: Stewardship | null;
  loadError: string | null;
};

/** Who helps the Team Lead run a developer project, and whether it still counts as active. */
export function StewardshipCard({ projectId, isLead, stewardship, loadError }: Props) {
  if (!stewardship) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <h2>Assistant Lead and activity</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p role="alert" className="text-destructive">
            We couldn&apos;t load the Assistant Lead and activity. {loadError}
          </p>
          <RefreshButton label="Try again" />
        </CardContent>
      </Card>
    );
  }

  const check = stewardship.activity_check;
  const pending = check?.status === "pending";
  return (
    <div className="space-y-4">
      {check && pending ? (
        <ActivityCheckAlert
          projectId={projectId}
          check={check}
          canConfirm={stewardship.actions.confirm_active}
          isLead={isLead}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <h2>Assistant Lead and activity</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <AssistantLead stewardship={stewardship} />
          <Activity stewardship={stewardship} />
          {stewardship.actions.choose_assistant_lead ? (
            <ChooseAssistantLead
              projectId={projectId}
              members={stewardship.members}
              current={stewardship.assistant_lead?.account_id ?? null}
            />
          ) : null}
          {stewardship.actions.close_project ? <CloseProjectButton projectId={projectId} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AssistantLead({ stewardship }: { stewardship: Stewardship }) {
  const assistant = stewardship.assistant_lead;
  return (
    <section aria-labelledby="assistant-lead-title" className="space-y-2">
      <h3 id="assistant-lead-title" className="flex items-center gap-1.5 font-medium">
        <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden />
        {assistant ? `Assistant Lead: ${assistant.display_name}` : "No Assistant Lead yet"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">An Assistant Lead can</p>
          <ul className="mt-1 space-y-1">
            {stewardship.assistant_lead_can.map((permission) => (
              <li key={permission.label} className="flex flex-wrap items-center gap-1.5">
                <CircleCheckIcon className="size-4 shrink-0 text-success" aria-hidden />
                <span>{permission.label}</span>
                {permission.available ? null : <PrototypeBadge label="Planned" />}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">An Assistant Lead can&apos;t</p>
          <ul className="mt-1 space-y-1">
            {stewardship.assistant_lead_cannot.map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <CircleXIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Activity({ stewardship }: { stewardship: Stewardship }) {
  const check = stewardship.activity_check;
  const due = stewardship.activity_check_due_at;
  const last = stewardship.lead_last_active_at;
  let line: string;
  if (stewardship.project_status === "Closed") line = "This project is closed.";
  else if (!last) line = "Activity is tracked once the project starts and its chat opens.";
  else if (check?.status === "pending") line = "The members are being asked whether the project is still active.";
  else if (due)
    line = `The Team Lead last wrote in the project chat ${formatMessageTime(last)}. If they don't write again by ${formatMessageTime(due)}, the members are asked whether the project is still active.`;
  else line = "";
  return (
    <section aria-labelledby="activity-title" className="space-y-1">
      <h3 id="activity-title" className="font-medium">
        Activity
      </h3>
      {line ? <p className="text-muted-foreground">{line}</p> : null}
      {check && check.status !== "pending" ? (
        <p className="text-muted-foreground">
          Last check, {formatMessageTime(check.ended_at)}: {endedCheckText(check)}
        </p>
      ) : null}
    </section>
  );
}
