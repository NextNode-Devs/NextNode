import { ArrowLeftIcon, LockIcon, ListChecksIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { MILESTONE_RULES, MilestonePlanList, sampleMilestoneDraft } from "@/entities/milestone";
import { getProject, parseBudget } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { AcceptMilestones, MilestonePlanForm } from "@/features/offer-milestones";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";

type Props = { projectId: Promise<string> };

/** Used when the project has no budget to start from (sample value, labelled on the page). */
const SAMPLE_TOTAL_CENTS = 600_000;

/**
 * `/projects/[id]/offer-milestones`: the milestones on a client project's
 * offer (Phase 2 prototype, NN-16a #94). Access is real (the project's
 * client, Team Lead and members); the schedule is sample data. The Lead
 * builds it, the client accepts it and picks the deposit-release milestone,
 * members read it. The Phase 1 offer on the project page is unchanged.
 */
export function OfferMilestonesView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading the offer milestones" />}>
          <OfferMilestonesScreen projectId={projectId} />
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

async function OfferMilestonesScreen({ projectId }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/offer-milestones`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load the offer milestones" message={route.message} />;

  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard as="h1" icon={<SearchXIcon aria-hidden />} title="Project not found" message="This link doesn't match a project on NextNode." action={projectsLink} />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={projectsLink} />
    ) : (
      <LoadError title="We couldn't load the offer milestones" message={result.error.message} />
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
        icon={<ListChecksIcon aria-hidden />}
        title="No offer on developer projects"
        message="Developer-created projects have no client offer, so there are no paid milestones."
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
        title="The offer is private"
        message="Only this project's client, Team Lead and team members can see its milestones."
        action={backLink}
      />
    );
  }

  const offerTotalCents = project.proposed_budget_cents ?? SAMPLE_TOTAL_CENTS;
  const rows = sampleMilestoneDraft(offerTotalCents);
  const milestones = rows.map((row, index) => ({
    sequence: index + 1,
    title: row.title,
    amount_cents: parseBudget(row.amount) ?? 0,
    due_date: row.due_date,
  }));
  const depositPercent = MILESTONE_RULES.defaultDepositPercent;

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> {project.title}
      </Link>
      <header className="space-y-2">
        <PrototypeBadge />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Offer milestones</h1>
        <p className="text-muted-foreground">
          {is_lead
            ? "Split the offer into milestones, each with an amount and a due date, and set the deposit."
            : is_owner
              ? "Review the milestones in the Team Lead's offer and choose which one releases your deposit."
              : "The milestones in this project's offer."}
        </p>
      </header>
      <PrototypeNotice title="Planned offer milestones, sample schedule">
        Nothing on this page is saved or sent. The schedule is sample data based on the project budget
        {project.proposed_budget_cents === undefined ? " (a sample total, since this project has none)" : ""}. The
        offer on the project page works as before.
      </PrototypeNotice>
      {is_lead ? (
        <MilestonePlanForm projectTitle={project.title} offerTotalCents={offerTotalCents} initialRows={rows} />
      ) : is_owner ? (
        <AcceptMilestones
          projectTitle={project.title}
          offerTotalCents={offerTotalCents}
          depositPercent={depositPercent}
          milestones={milestones}
        />
      ) : (
        <div className="space-y-3">
          <MilestonePlanList milestones={milestones} />
          <p className="text-sm text-muted-foreground">
            The client accepts all milestones together and chooses milestone 1 or 2 to release the {depositPercent} %
            deposit to the team.
          </p>
        </div>
      )}
    </div>
  );
}
