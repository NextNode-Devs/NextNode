import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getViewer, routeFor } from "@/entities/viewer";
import { OnboardingForm } from "@/features/complete-onboarding";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";

/**
 * First stop after registering. Only signed-in users without an account see
 * the form; anyone already onboarded goes straight to the dashboard.
 */
export function OnboardingView() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-highlight">Set up your account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome to NextNode</h1>
        <p className="text-muted-foreground">Tell us how you&apos;ll use NextNode and fill in your profile.</p>
      </header>
      <Suspense fallback={<LoadingCards count={2} label="Loading your account" />}>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect("/sign-in?redirect_url=/onboarding");
  if (route.kind === "dashboard") redirect("/dashboard");
  if (route.kind === "error") {
    return <LoadError title="We couldn't load your account" message={route.message} />;
  }
  const user = await currentUser().catch(() => null);
  return <OnboardingForm defaultDisplayName={user?.fullName ?? user?.firstName ?? ""} />;
}
