import { ArrowLeftIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMyPortfolio } from "@/entities/developer";
import { getViewer, routeFor } from "@/entities/viewer";
import { EditPortfolioForm } from "@/features/edit-portfolio";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";

/** `/developers/me/edit`: the signed-in developer edits their own portfolio. */
export function EditPortfolioView() {
  return (
    <>
      <AppHeader current="developers" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/developers/me"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to your portfolio
        </Link>
        <Suspense fallback={<LoadingCards count={3} label="Loading your portfolio" />}>
          <EditScreen />
        </Suspense>
      </main>
    </>
  );
}

async function EditScreen() {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect("/sign-in?redirect_url=/developers/me/edit");
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return (
      <>
        <h1 className="sr-only">Edit your portfolio</h1>
        <LoadError title="We couldn't load your portfolio" message={route.message} />
      </>
    );
  }
  if (route.viewer.account.role !== "developer") {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="Only developers have a portfolio"
        message="Your account is a client account, so there's no portfolio to edit. You can browse developers and open theirs."
        action={
          <Button asChild variant="outline">
            <Link href="/developers">Browse developers</Link>
          </Button>
        }
      />
    );
  }

  const result = await getMyPortfolio(authedServerApi);
  if (!result.ok) {
    return (
      <>
        <h1 className="sr-only">Edit your portfolio</h1>
        <LoadError title="We couldn't load your portfolio" message={result.error.message} />
      </>
    );
  }
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Edit your portfolio</h1>
        <p className="text-muted-foreground">
          Clients and other developers see this when they open your portfolio from the directory.
        </p>
      </header>
      <EditPortfolioForm portfolio={result.data} />
    </>
  );
}
