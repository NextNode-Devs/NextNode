import { CrownIcon } from "lucide-react";

import { SEAT_STATE_LABEL, type TeamChangesSnapshot, type TeamViewer } from "@/entities/team";
import { LeaveTeamButton } from "@/features/leave-team";
import { RemoveMemberButton } from "@/features/remove-team-member";
import { formatMomentDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = { snapshot: TeamChangesSnapshot; viewer: TeamViewer };

/** Who is on the team, who left or was removed, and the actions the viewer has on them. */
export function TeamSeats({ snapshot, viewer }: Props) {
  const active = snapshot.seats.filter((s) => s.state === "active").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>
            Team <span className="font-normal text-muted-foreground">· {active} of {snapshot.team_size}</span>
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {snapshot.seats.map((seat) => {
            const gone = seat.state !== "active";
            return (
              <li key={seat.account_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className={cn("min-w-0 space-y-0.5", gone && "text-muted-foreground")}>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {seat.role === "lead" ? <CrownIcon className="size-4 text-warning" aria-hidden /> : null}
                    <span className={cn(gone && "line-through")}>{seat.display_name}</span>
                    {seat.role === "lead" ? <Badge variant="secondary">Team Lead</Badge> : null}
                    {gone ? <Badge variant="outline">{SEAT_STATE_LABEL[seat.state]}</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gone
                      ? `${SEAT_STATE_LABEL[seat.state]} ${formatMomentDate(seat.ended_at)} · no access`
                      : seat.skills.join(" · ")}
                  </p>
                </div>
                {viewer === "lead" && seat.role === "member" && !gone ? (
                  <RemoveMemberButton name={seat.display_name} />
                ) : null}
              </li>
            );
          })}
        </ul>
        {viewer === "client" ? null : (
          <div className="border-t pt-3">
            <LeaveTeamButton asLead={viewer === "lead"} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
