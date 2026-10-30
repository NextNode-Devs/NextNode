import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getViewer, routeFor } from "@/entities/viewer";
import { RealtimeProvider } from "@/shared/api/realtime";
import { isAuthConfigured } from "@/shared/config/env.public";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { AppHeader } from "@/widgets/app-header";
import { ConnectionStatus } from "@/widgets/connection-status";
import { DashboardShell } from "@/widgets/dashboard-shell";

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
  return <DashboardShell account={route.viewer.account} />;
}
