import { ArrowRightIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { TeamLiveRefresh } from "@/entities/team";
import { getViewer, routeFor } from "@/entities/viewer";
import { RealtimeProvider } from "@/shared/api/realtime";
import { isAuthConfigured } from "@/shared/config/env.public";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";
import { ConnectionStatus } from "@/widgets/connection-status";
import { ConversationList } from "@/widgets/conversation-list";
import { DashboardShell } from "@/widgets/dashboard-shell";
import { MyLeadCandidacies } from "@/widgets/my-lead-candidacies";
import { MyProjects } from "@/widgets/my-projects";
import { TeamCandidacies } from "@/widgets/team-candidacies";

/** The signed-in home. Users without an account are sent to onboarding first. */
export function DashboardView() {
  const page = (
    <>
      <AppHeader current="dashboard" status={isAuthConfigured() ? <ConnectionStatus /> : null} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<LoadingCards count={4} label="Loading your dashboard" />}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
  // The live socket needs Clerk; without keys nobody reaches this page anyway.
  return isAuthConfigured() ? <RealtimeProvider>{page}</RealtimeProvider> : page;
}

async function Dashboard() {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect("/sign-in?redirect_url=/dashboard");
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return (
      <>
        <h1 className="sr-only">Dashboard</h1>
        <LoadError title="We couldn't load your dashboard" message={route.message} />
      </>
    );
  }
  const account = route.viewer.account;
  const lead = (show: "all" | "application" | "invitation") => (
    <Suspense fallback={<LoadingCards count={1} label="Loading" />}>
      <MyLeadCandidacies role={account.role} show={show} />
    </Suspense>
  );
  const team = (show: "applications" | "invitations") => (
    <Suspense fallback={<LoadingCards count={1} label="Loading" />}>
      <TeamCandidacies show={show} />
    </Suspense>
  );
  return (
    <DashboardShell
      account={account}
      sections={{
        "my-projects": (
          <Suspense fallback={<LoadingCards count={1} label="Loading your projects" />}>
            <MyProjects role={account.role} />
          </Suspense>
        ),
        // A client sees Hire Lead's applicants and invitees together. A developer sees
        // invitations and applications apart: to lead a project (#4) and to join a team (#5).
        ...(account.role === "client"
          ? { applications: lead("all") }
          : {
              applications: <TwoLists lead={lead("application")} team={team("applications")} />,
              invitations: (
                <>
                  {isAuthConfigured() ? <TeamLiveRefresh /> : null}
                  <TwoLists lead={lead("invitation")} team={team("invitations")} />
                </>
              ),
            }),
        conversations: (
          <div className="space-y-3">
            <ConversationList
              myAccountId={account.id}
              limit={3}
              emptyText={
                account.role === "client"
                  ? "Conversations with Team Lead candidates will appear here, with unread counts."
                  : "Hiring and team conversations will appear here, with unread counts."
              }
            />
            <Link
              href="/conversations"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              Open conversations <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        ),
        portfolio: account.role === "developer" ? <PortfolioSection /> : <FindDevelopersSection />,
      }}
    />
  );
}

function TwoLists({ lead, team }: { lead: ReactNode; team: ReactNode }) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">To lead a project</h3>
        {lead}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium">To join a team</h3>
        {team}
      </section>
    </div>
  );
}

function PortfolioSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        What clients see when they find you in the developer directory: your projects, skills, links and whether
        you&apos;re available for work.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/developers/me/edit">
            <PencilIcon aria-hidden /> Edit portfolio
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/developers/me">View portfolio</Link>
        </Button>
      </div>
    </div>
  );
}

function FindDevelopersSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Search developers by skill, see who&apos;s available for work, and open their portfolios.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/developers">
          Browse developers <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
