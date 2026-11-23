import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { daysBetween, type TeamViewer } from "@/entities/team";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  viewer: TeamViewer;
  leadName: string;
  lastActiveAt: string;
  asOf: string;
  chatHref: string;
};

const NEXT: Record<TeamViewer, string> = {
  member: "You can propose a new Lead from the current members below. The client approves.",
  client: "The team can propose a new Lead from its members. You'll be asked to approve them.",
  lead: "Write in the team chat to keep leading. Otherwise the team can propose a new Lead.",
};

/** The "Lead unresponsive" banner: the Lead has been quiet for 3 days or more (NN-38). */
export function LeadQuietBanner({ viewer, leadName, lastActiveAt, asOf, chatHref }: Props) {
  const days = daysBetween(lastActiveAt, asOf);
  const who = viewer === "lead" ? "You haven't" : `${leadName} hasn't`;
  return (
    <Alert className="border-warning/50">
      <TriangleAlertIcon className="text-warning" aria-hidden />
      <AlertTitle>
        {who} responded for {days} days
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Last active {formatMessageTime(lastActiveAt)}. {NEXT[viewer]}
        </p>
        {viewer === "lead" ? (
          <Button asChild size="sm" variant="outline">
            <Link href={chatHref}>Open the team chat</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
