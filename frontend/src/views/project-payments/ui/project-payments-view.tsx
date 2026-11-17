import { ArrowLeftIcon, LockIcon, SearchXIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SAMPLE_MILESTONE_PLAN } from "@/entities/milestone";
import { SAMPLE_PLANNED_PAYMENTS } from "@/entities/payment";
import { getProject } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { MilestonePayments } from "@/widgets/milestone-payments";

type Props = { projectId: Promise<string> };

/**
 * `/projects/[id]/payments`: the PLANNED deposit holding for a client
 * project (Phase 2 prototype, NN-37 #96). Access is real (the project's
 * client, Team Lead and members); the payments are sample data.
 */
export function ProjectPaymentsView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading payments" />}>
          <PaymentsScreen projectId={projectId} />
        </Suspense>
      </main>
    </>
  );
}

const projectsLink = (
  <Button asChild variant="outline">
    <Link href="/projects">Browse projects</Link>
  </Button>
);

async function PaymentsScreen({ projectId }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/payments`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return <LoadError title="We couldn't load payments" message={route.message} />;
  }

  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Project not found"
        message="This link doesn't match a project on NextNode."
        action={projectsLink}
      />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={projectsLink} />
    ) : (
      <LoadError title="We couldn't load payments" message={result.error.message} />
    );
  }

  const project = result.data;
  const backLink = (
    <Button asChild variant="outline">
      <Link href={`/projects/${project.id}`}>Back to the project</Link>
    </Button>
  );
  if (project.kind !== "client") {
    return (
      <StateCard
        as="h1"
        icon={<WalletIcon aria-hidden />}
        title="No payments on developer projects"
        message="Developer-created projects have no offer, deposit or payments."
        action={backLink}
      />
    );
  }
  const { is_owner, is_lead, is_member } = project.viewer;
  if (!is_owner && !is_lead && !is_member) {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="Payments are private"
        message="Only this project's client, Team Lead and team members can see its payments."
        action={backLink}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> {project.title}
      </Link>
      <header className="space-y-2">
        <PrototypeBadge label="Planned" />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payments</h1>
        <p className="text-muted-foreground">
          {is_owner
            ? "What you've paid, when your deposit goes to the team, and your receipts."
            : "What the client has paid, and when the deposit is released to the team."}
        </p>
      </header>
      <PrototypeNotice title="Planned payment model, sample data">
        Nothing on this page charges, holds or moves money. The live deposit on the project page works as before
        (Stripe test mode). Holding the deposit until a milestone is approved is planned for a later build.
      </PrototypeNotice>
      <MilestonePayments
        viewer={is_owner ? "client" : "team"}
        plan={SAMPLE_MILESTONE_PLAN}
        payments={SAMPLE_PLANNED_PAYMENTS}
      />
    </div>
  );
}
