import { CircleCheckIcon, ClockIcon, LinkIcon, LockIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { describeInviteLink, expiresIn, type InviteLink } from "@/entities/invite-link";
import { projectHref, TechStack, type Project } from "@/entities/project";
import { formatMessageTime } from "@/shared/lib/format-date";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { inviterName, type InviteScreenState } from "../model/screen-state";
import { JoinActions } from "./join-actions";

type Props = {
  state: InviteScreenState;
  link: InviteLink | null;
  project: Project | null;
  now: string;
};

const browse = (
  <Button asChild variant="outline">
    <Link href="/projects">Browse projects</Link>
  </Button>
);

/** One screen per state of an invite link, each with a way forward. */
export function InviteScreen({ state, link, project, now }: Props) {
  if (state === "invalid" || !link || !project) {
    return (
      <StateCard
        as="h1"
        icon={<LinkIcon aria-hidden />}
        title="This invite link isn't valid"
        message="It may be mistyped or incomplete. Ask the Team Lead who sent it for a new link."
        action={browse}
      />
    );
  }

  const inviter = inviterName(project);
  const toProject = (
    <Button asChild variant="outline">
      <Link href={projectHref(project.id)}>View the project</Link>
    </Button>
  );

  switch (state) {
    case "expired":
      return (
        <StateCard
          as="h1"
          icon={<ClockIcon aria-hidden />}
          title="This invite link has expired"
          message={`It stopped working on ${formatMessageTime(link.expires_at)} ET. Invite links last a limited time, so ask ${inviter} for a new one.`}
          action={browse}
        />
      );
    case "used":
      return (
        <StateCard
          as="h1"
          icon={<CircleCheckIcon aria-hidden />}
          title="This invite link has already been used"
          message={`Each invite link lets one developer join, and someone has joined ${project.title} with this one. If it was meant for you, ask ${inviter} for a new link.`}
          action={browse}
        />
      );
    case "client":
      return (
        <StateCard
          as="h1"
          icon={<LockIcon aria-hidden />}
          title="Only developers can join a team"
          message="You're signed in as a client. If this link was meant for a developer, send it to them."
          action={browse}
        />
      );
    case "on-team":
      return (
        <StateCard
          as="h1"
          icon={<UsersIcon aria-hidden />}
          title={`You're already part of ${project.title}`}
          message="This link is for a developer who isn't on the project yet."
          action={toProject}
        />
      );
    case "full":
      return (
        <StateCard
          as="h1"
          icon={<UsersIcon aria-hidden />}
          title="This team isn't taking new members"
          message={`${project.title} has no open spots now. Ask ${inviter} whether a spot will open, or look for another project.`}
          action={browse}
        />
      );
    case "ready":
      return <Invitation link={link} project={project} inviter={inviter} now={now} toProject={toProject} />;
  }
}

function Invitation(props: { link: InviteLink; project: Project; inviter: string; now: string; toProject: ReactNode }) {
  const { link, project, inviter, now } = props;
  const spots = project.team.open_spots;
  const left = expiresIn(link.expires_at, now);
  return (
    <Card>
      <CardHeader>
        <CardDescription>{inviter} invited you to join their team</CardDescription>
        <CardTitle className="text-xl">
          <h1>{project.title}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <TechStack tech={project.tech_stack} />
        <ul className="space-y-1.5 text-muted-foreground">
          <li className="flex items-center gap-2">
            <UsersIcon className="size-4 shrink-0" aria-hidden />
            {project.team.size === null
              ? "The team size isn't set yet. Teams have 5 to 7 people."
              : `${spots} open ${spots === 1 ? "spot" : "spots"} on a team of ${project.team.size}`}
          </li>
          <li className="flex items-center gap-2">
            <ClockIcon className="size-4 shrink-0" aria-hidden />
            {left ? `This link expires ${left}, on ${formatMessageTime(link.expires_at)} ET.` : describeInviteLink(link, now)}
          </li>
        </ul>
        <p>The link works once: if you join with it, you go straight onto the team.</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <JoinActions />
        {props.toProject}
      </CardFooter>
    </Card>
  );
}
