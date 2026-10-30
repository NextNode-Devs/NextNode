import { CircleCheckIcon, CircleXIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Deposit } from "@/entities/payment";
import { PayDepositButton, TestModeNote } from "@/features/make-deposit";
import type { ApiError } from "@/shared/api/server-client";
import { formatMoney } from "@/shared/lib/format-money";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import { ConfirmingPayment } from "./confirming-payment";
import { RefreshButton } from "@/shared/ui/refresh-button";

export type Mode = "return" | "cancelled";
export type Outcome =
  | { state: "loading" }
  | { state: "ready"; deposit: Deposit }
  | { state: "error"; error: ApiError };

type Props = { mode: Mode; projectId: string; outcome: Outcome };

function amountOf(deposit: Deposit): string | null {
  return deposit.amount_cents !== null && deposit.currency
    ? formatMoney(deposit.amount_cents, deposit.currency)
    : null;
}

function Shell(props: { icon?: ReactNode; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {props.icon}
          <h2>{props.title}</h2>
        </CardTitle>
        {props.description ? <CardDescription>{props.description}</CardDescription> : null}
      </CardHeader>
      {props.children ? <CardContent className="space-y-4">{props.children}</CardContent> : null}
    </Card>
  );
}

function BackToProject({ projectId }: { projectId: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={`/projects/${projectId}`}>Back to the project</Link>
    </Button>
  );
}

function ErrorState({ error }: { error: ApiError }) {
  if (error.code === "UNAUTHENTICATED") {
    return (
      <Shell
        icon={<LockIcon className="size-5" aria-hidden />}
        title="Sign in to see this payment"
        description="Only this project's client can see its deposit. Sign in with that account and open this page again."
      />
    );
  }
  if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") {
    return (
      <Shell
        icon={<LockIcon className="size-5" aria-hidden />}
        title="You can't view this payment"
        description="This project doesn't exist, or its deposit belongs to another account. Only the project's client can see it."
      />
    );
  }
  return (
    <Shell
      icon={<TriangleAlertIcon className="size-5 text-destructive" aria-hidden />}
      title="We couldn't check your deposit"
    >
      <p role="alert" className="text-sm text-destructive">
        {error.message} Your payment, if you made one, is not affected.
      </p>
      <RefreshButton label="Try again" />
    </Shell>
  );
}

function ReturnState({ projectId, deposit }: { projectId: string; deposit: Deposit }) {
  const amount = amountOf(deposit);
  switch (deposit.status) {
    case "completed":
      return (
        <Shell
          icon={<CircleCheckIcon className="size-5 text-success" aria-hidden />}
          title="Deposit confirmed: your team is now active"
          description={`Stripe confirmed ${amount ?? "the deposit"}. The project is in progress and your team can start work.`}
        >
          <BackToProject projectId={projectId} />
        </Shell>
      );
    case "pending":
      return (
        <Shell title={amount ? `Deposit of ${amount}` : "Deposit"}>
          <ConfirmingPayment />
        </Shell>
      );
    case "failed":
      return (
        <Shell
          icon={<CircleXIcon className="size-5 text-destructive" aria-hidden />}
          title="The payment didn't go through"
          description="Nothing was charged. You can start a new checkout."
        >
          <TestModeNote />
          <PayDepositButton projectId={projectId} label="Try again" />
        </Shell>
      );
    case "none":
      return (
        <Shell
          title="No deposit checkout yet"
          description="There is no checkout for this project's deposit. Start it from the project page."
        >
          <BackToProject projectId={projectId} />
        </Shell>
      );
  }
}

function CancelledState({ projectId, deposit }: { projectId: string; deposit: Deposit }) {
  if (deposit.status === "completed") {
    return <ReturnState projectId={projectId} deposit={deposit} />;
  }
  return (
    <Shell
      icon={<CircleXIcon className="size-5 text-muted-foreground" aria-hidden />}
      title="Checkout cancelled"
      description="Nothing was charged. Your project starts once the deposit is paid."
    >
      <TestModeNote />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <PayDepositButton projectId={projectId} label="Try again" />
        <BackToProject projectId={projectId} />
      </div>
    </Shell>
  );
}

/** Presentational: renders the state it is given, always from the server. */
export function DepositResultCard({ mode, projectId, outcome }: Props) {
  if (outcome.state === "loading") {
    return (
      <Card aria-busy>
        <CardContent className="space-y-3" role="status" aria-label="Checking your deposit">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    );
  }
  if (outcome.state === "error") return <ErrorState error={outcome.error} />;
  return mode === "return" ? (
    <ReturnState projectId={projectId} deposit={outcome.deposit} />
  ) : (
    <CancelledState projectId={projectId} deposit={outcome.deposit} />
  );
}
