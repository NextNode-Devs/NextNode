import { LockIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { inviteLinkPath, sampleInviteLinkByToken } from "@/entities/invite-link";
import { getProject } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { AppHeader } from "@/widgets/app-header";

import { inviteScreenState } from "../model/screen-state";
import { InviteScreen } from "./invite-screen";

type Props = { token: Promise<string> };

/**
 * `/invite/[token]` (PROTOTYPE, NN-26 #90): what a developer sees when they
 * open a team's invite link. The project is real; the link is sample data
 * until the API issues signed, single-use tokens.
 */
export function InviteLinkView({ token }: Props) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <PrototypeNotice title="Prototype: invite links">
          Invite links use sample data, worked out from the link. Joining with a link is under construction.
        </PrototypeNotice>
        <Suspense
          fallback={
            <div role="status" aria-label="Checking the invite link">
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          }
        >
          <InviteLinkScreen token={token} />
        </Suspense>
      </main>
    </>
  );
}

async function InviteLinkScreen({ token }: Props) {
  const raw = await token;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=${encodeURIComponent(inviteLinkPath(raw))}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't check this invite link" message={route.message} />;

  // Read after the request data above, so it is per-request (never prerendered).
  const now = new Date().toISOString();
  const link = sampleInviteLinkByToken(raw, now);
  const result = link ? await getProject(authedServerApi, link.project_id) : null;
  if (result && !result.ok && result.error.code === "FORBIDDEN") {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="You can't view this project"
        message={result.error.message}
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Browse projects</Link>
          </Button>
        }
      />
    );
  }
  if (result && !result.ok && result.error.code !== "NOT_FOUND") {
    return <LoadError title="We couldn't check this invite link" message={result.error.message} />;
  }

  const project = result?.ok ? result.data : null;
  const state = inviteScreenState(link, project, route.viewer.account.role);
  return <InviteScreen state={state} link={link} project={project} now={now} />;
}
