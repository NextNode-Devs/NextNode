import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getDeposit } from "@/entities/payment";

import { DepositResultCard, type Mode } from "./deposit-result-card";

/** `projectId` comes straight from the route's params and is checked here. */
type Props = { mode: Mode; projectId: Promise<string> };

async function DepositResultFromServer({ mode, projectId: pending }: Props) {
  const projectId = await pending;
  if (!/^\d+$/.test(projectId)) notFound();
  const result = await getDeposit(projectId);
  return (
    <DepositResultCard
      mode={mode}
      projectId={projectId}
      outcome={result.ok ? { state: "ready", deposit: result.data } : { state: "error", error: result.error }}
    />
  );
}

/** Streams the uncached deposit status behind a loading state. */
export function DepositResult(props: Props) {
  return (
    <Suspense fallback={<DepositResultCard mode={props.mode} projectId="" outcome={{ state: "loading" }} />}>
      <DepositResultFromServer {...props} />
    </Suspense>
  );
}
