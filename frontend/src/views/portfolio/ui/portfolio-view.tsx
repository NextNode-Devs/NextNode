import { ArrowLeftIcon, CircleCheckIcon, LockIcon, PencilIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getPortfolio, PortfolioProfile, portfolioHref } from "@/entities/developer";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { AppHeader } from "@/widgets/app-header";

import { PortfolioActions } from "./portfolio-actions";

type Props = {
  /** A developer's account id, or `"me"` for the signed-in developer's own. */
  developerId: Promise<string>;
  /** `?saved=1` after the owner saves, so the change is confirmed on the page they land on. */
  saved?: Promise<boolean>;
};

/** `/developers/[id]`: a developer's portfolio, for any signed-in user. */
export function PortfolioView(props: Props) {
  return (
    <>
      <AppHeader current="developers" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/developers"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> All developers
        </Link>
        <Suspense fallback={<LoadingCards count={2} label="Loading the portfolio" />}>
          <PortfolioScreen {...props} />
        </Suspense>
      </main>
    </>
  );
}

const directoryLink = (
  <Button asChild variant="outline">
    <Link href="/developers">Browse developers</Link>
  </Button>
);

async function PortfolioScreen({ developerId, saved }: Props) {
  const id = await developerId;
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/developers/${encodeURIComponent(id)}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return (
      <>
        <h1 className="sr-only">Portfolio</h1>
        <LoadError title="We couldn't load this portfolio" message={route.message} />
      </>
    );
  }

  const me = route.viewer.account;
  if (id === "me") {
    if (me.role === "developer") redirect(portfolioHref(me.id));
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="Clients don't have a portfolio"
        message="Portfolios belong to developer accounts. You can browse developers and open theirs."
        action={directoryLink}
      />
    );
  }

  const accountId = /^\d+$/.test(id) ? Number(id) : null;
  const result = accountId ? await getPortfolio(authedServerApi, accountId) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return (
      <StateCard
        as="h1"
        icon={<SearchXIcon aria-hidden />}
        title="Developer not found"
        message="This link doesn't match a developer on NextNode. It may be mistyped, or the account may belong to a client."
        action={directoryLink}
      />
    );
  }
  if (!result.ok && result.error.code === "FORBIDDEN") {
    return (
      <StateCard
        as="h1"
        icon={<LockIcon aria-hidden />}
        title="You can't view this portfolio"
        message={result.error.message}
        action={directoryLink}
      />
    );
  }
  if (!result.ok) {
    return (
      <>
        <h1 className="sr-only">Portfolio</h1>
        <LoadError title="We couldn't load this portfolio" message={result.error.message} />
      </>
    );
  }

  const portfolio = result.data;
  const justSaved = portfolio.is_owner && (await saved);
  return (
    <>
      {justSaved ? (
        <Alert role="status" className="border-success/40">
          <CircleCheckIcon className="text-success" aria-hidden />
          <AlertTitle>Portfolio saved</AlertTitle>
          <AlertDescription>This is how clients and other developers see it now.</AlertDescription>
        </Alert>
      ) : null}
      <PortfolioProfile
        portfolio={portfolio}
        actions={
          portfolio.is_owner ? (
            <Button asChild>
              <Link href="/developers/me/edit">
                <PencilIcon aria-hidden /> Edit portfolio
              </Link>
            </Button>
          ) : (
            <PortfolioActions portfolio={portfolio} viewerRole={me.role} />
          )
        }
      />
    </>
  );
}
