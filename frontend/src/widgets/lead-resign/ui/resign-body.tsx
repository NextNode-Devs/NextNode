import { CircleCheckIcon, HourglassIcon, PenLineIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { replacementSignature, type LeadResignSnapshot, type ResignViewer } from "@/entities/team";
import { SignOfferForm } from "@/features/sign-offer-as-lead";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  snapshot: LeadResignSnapshot;
  viewer: ResignViewer;
  links: { team: string; chat: string };
};

/** The main card: what is happening and the viewer's part in it. */
export function ResignBody({ snapshot, viewer, links }: Props) {
  const { icon, title, body } = viewer === "new_lead" ? forNewLead(snapshot, links) : forClient(snapshot, links);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg [&_svg]:size-5 [&_svg]:shrink-0">
          {icon}
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{body}</CardContent>
    </Card>
  );
}

type Content = { icon: ReactNode; title: string; body: ReactNode };

const linkButton = (href: string, label: string, variant: "default" | "outline" = "outline") => (
  <Button asChild size="sm" variant={variant}>
    <Link href={href}>{label}</Link>
  </Button>
);

function forNewLead(snapshot: LeadResignSnapshot, links: Props["links"]): Content {
  const { offer, client, outgoing_lead: outgoing } = snapshot;
  const v = offer.version;
  if (snapshot.situation === "awaiting_approval") {
    return {
      icon: <HourglassIcon className="text-muted-foreground" aria-hidden />,
      title: "Nothing to sign yet",
      body: (
        <>
          <p>
            On {formatMessageTime(snapshot.proposed_at)}, {snapshot.proposed_by} proposed you as the new Team Lead. Once{" "}
            {client.display_name} approves, offer version {v} shows here for you to sign.
          </p>
          <p className="text-muted-foreground">Keep working as usual meanwhile. You&apos;ll get a notification.</p>
          {linkButton(links.team, "Back to the Team tab")}
        </>
      ),
    };
  }
  if (snapshot.situation === "signed") {
    const signedAt = replacementSignature(snapshot)?.signed_at ?? null;
    return {
      icon: <CircleCheckIcon className="text-success" aria-hidden />,
      title: "You're the Team Lead now",
      body: (
        <>
          <p role="status">
            On {formatMessageTime(signedAt)}, you signed offer version {v}. The team and {client.display_name} were told.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The terms carry on unchanged: same total, deposit, dates and milestones.</li>
            <li>You now pick replacements, post updates and run the team chat.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {linkButton(links.chat, "Open the team chat", "default")}
            {linkButton(links.team, "Back to the Team tab")}
          </div>
        </>
      ),
    };
  }
  return {
    icon: <PenLineIcon className="text-warning" aria-hidden />,
    title: `Sign offer version ${v} to take over`,
    body: (
      <>
        <p>
          On {formatMessageTime(snapshot.approved_at)}, {client.display_name} approved you as Team Lead. To take over
          from {outgoing.display_name}, sign the offer the client already accepted.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            The terms don&apos;t change. {snapshot.milestones.approved} of {snapshot.milestones.total} milestones are
            already approved, and the rest stay as planned.
          </li>
          <li>Your signature is added next to the original Lead&apos;s. The client doesn&apos;t sign again.</li>
          <li>{outgoing.display_name} already lost access. Their work, files and messages stay with the project.</li>
        </ul>
        <SignOfferForm version={v} outgoingLead={outgoing.display_name} />
      </>
    ),
  };
}

function forClient(snapshot: LeadResignSnapshot, links: Props["links"]): Content {
  const name = snapshot.new_lead.display_name;
  const v = snapshot.offer.version;
  if (snapshot.situation === "awaiting_approval") {
    return {
      icon: <HourglassIcon className="text-warning" aria-hidden />,
      title: `Approve ${name} first`,
      body: (
        <>
          <p>
            The team proposed {name} as the new Lead. Nothing is signed until you approve them on the Team tab.
          </p>
          {linkButton(links.team, "Review the proposal", "default")}
        </>
      ),
    };
  }
  if (snapshot.situation === "signed") {
    return {
      icon: <CircleCheckIcon className="text-success" aria-hidden />,
      title: `${name} is the Team Lead`,
      body: (
        <>
          <p role="status">
            On {formatMessageTime(replacementSignature(snapshot)?.signed_at)}, {name} signed offer version {v}. Nothing
            changes for you: same terms, same milestones.
          </p>
          {linkButton(links.team, "Back to the Team tab")}
        </>
      ),
    };
  }
  return {
    icon: <HourglassIcon className="text-warning" aria-hidden />,
    title: `Waiting for ${name} to sign`,
    body: (
      <>
        <p>
          On {formatMessageTime(snapshot.approved_at)}, you approved {name}. They sign offer version {v}, the one you
          accepted on {formatMessageTime(snapshot.offer.decided_at)}, so you don&apos;t need to accept it again.
        </p>
        {linkButton(links.team, "Back to the Team tab")}
      </>
    ),
  };
}
