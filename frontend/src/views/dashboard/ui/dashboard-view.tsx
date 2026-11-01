import { ArrowRightIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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
  return (
    <DashboardShell
      account={account}
      sections={{
        "my-projects": (
          <Suspense fallback={<LoadingCards count={1} label="Loading your projects" />}>
            <MyProjects role={account.role} />
          </Suspense>
        ),
        // Hire Lead (#4). A client sees applicants and invitees together; a developer
        // sees invitations and applications apart. #5 adds team ones alongside.
        applications: lead(account.role === "client" ? "all" : "application"),
        ...(account.role === "developer" ? { invitations: lead("invitation") } : {}),
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
