import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { isAccessRemovalReason } from "@/entities/team";
import { getViewer, routeFor } from "@/entities/viewer";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { AccessRemovedPanel } from "@/widgets/access-removed";
import { AppHeader } from "@/widgets/app-header";

type Props = {
  projectId: Promise<string>;
  /** `?reason=left|removed|lead_replaced`: which sample to open on. */
  reason: Promise<string | string[] | undefined>;
};

/**
 * `/projects/[id]/no-access`: what someone who left or was removed sees when
 * they open the project (NN-38, prototype). The planned API answers
 * `FORBIDDEN` with the reason; until then the screen shows sample data.
 */
export function AccessRemovedView(props: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Dashboard
        </Link>
        <Suspense fallback={<LoadingCards count={1} label="Loading" />}>
          <AccessRemovedScreen {...props} />
        </Suspense>
      </main>
    </>
  );
}

async function AccessRemovedScreen({ projectId, reason }: Props) {
  const [id, raw] = await Promise.all([projectId, reason]);
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/no-access`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load this page" message={route.message} />;

  const initial = isAccessRemovalReason(raw) ? raw : undefined;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">You no longer have access to this project</h1>
        <p className="text-muted-foreground">
          Whoever leaves a team, or is removed from it, loses access straight away.
        </p>
      </header>
      <PrototypeNotice>
        This screen shows a sample project. Developers see it when they open a project they left or were removed from;
        clients always keep access to their own projects.
      </PrototypeNotice>
      <AccessRemovedPanel initial={initial} />
    </div>
  );
}
