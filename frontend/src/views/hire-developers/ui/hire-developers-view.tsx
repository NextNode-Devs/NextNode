import { ArrowLeftIcon, LockIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { getProject } from "@/entities/project";
import { getTeam } from "@/entities/team";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { SuggestedDevelopers } from "@/widgets/suggested-developers";

type Props = { projectId: Promise<string> };

/**
 * `/projects/[id]/hire`: Hire Devs for a team with open spots (NN-33,
 * prototype). The Team Lead sees suggested developers with the reason for
 * each; inviting stays the #5 flow on the developer's portfolio.
 */
export function HireDevelopersView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading suggested developers" />}>
          <HireScreen projectId={projectId} />
        </Suspense>
      </main>
    </>
  );
}

const button = (href: string, label: string) => (
  <Button asChild variant="outline">
    <Link href={href}>{label}</Link>
  </Button>
);

async function HireScreen({ projectId }: Props) {
  const id = await projectId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(id)}/hire`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load this project" message={route.message} />;

  const numeric = /^\d+$/.test(id) ? Number(id) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Project not found"
        message="This link doesn't match a project on NextNode. It may be mistyped."
        action={button("/projects", "Browse projects")}
      />
    );
  }
  if (!result.ok) {
    return result.error.code === "FORBIDDEN" ? (
      <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} />
    ) : (
      <LoadError title="We couldn't load this project" message={result.error.message} />
    );
  }

  const project = result.data;
  const overview = `/projects/${project.id}`;
  if (!project.viewer.is_lead) {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="Only the Team Lead hires developers"
        message="Suggested developers are for the Team Lead of this project. Members and clients see the team on the overview."
        action={button(overview, "Back to the project")}
      />
    );
  }

  const team = await getTeam(authedServerApi, project.id);
  if (!team.ok) return <LoadError title="We couldn't load this team" message={team.error.message} />;
  if (team.data.status !== "open" || team.data.open_spots === 0) {
    return (
      <StateCard
        as="h1"
        icon={<UsersIcon aria-hidden />}
        title="No open spots"
        message={
          team.data.status === "open"
            ? "The team is full. Set a larger team size on the overview to hire more developers."
            : "Recruitment has closed for this team."
        }
        action={button(overview, "Back to the project")}
      />
    );
  }

  const spots = team.data.open_spots;
  return (
    <Page title={project.title} overview={overview}>
      <p className="text-muted-foreground">
        {team.data.members.length} on the team · {spots} open {spots === 1 ? "spot" : "spots"}. Pick from the suggestions
        or browse everyone.
      </p>
      <PrototypeNotice>
        Suggestions are scored in your browser from the first page of developers, by the rule shown with each one. The
        real version scores every developer on the server. Inviting works as before, from the developer&apos;s
        portfolio.
      </PrototypeNotice>
      <SuggestedDevelopers project={project} team={team.data} myAccountId={route.viewer.account.id} />
      <section aria-labelledby="all-developers-heading" className="space-y-2 rounded-xl border p-4 sm:p-5">
        <h2 id="all-developers-heading" className="text-base font-semibold">
          All developers
        </h2>
        <p className="text-sm text-muted-foreground">
          Search everyone by skills, availability, time zone and new talent.
        </p>
        {button("/developers", "Browse all developers")}
      </section>
    </Page>
  );
}

function Page({ title, overview, children }: { title: string; overview: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Link
        href={overview}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Back to the project
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hire developers</h1>
        <p className="font-medium">{title}</p>
      </header>
      {children}
    </div>
  );
}
