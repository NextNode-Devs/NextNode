import { Suspense } from "react";

import { getHealth } from "../api/get-health";
import { BackendStatusCard } from "./backend-status-card";

async function BackendStatusResult() {
  const result = await getHealth();
  return result.ok ? (
    <BackendStatusCard state="ready" health={result.data} />
  ) : (
    <BackendStatusCard state="error" message={result.error.message} />
  );
}

/** Streams the uncached health check behind a loading state. */
export function BackendStatus() {
  return (
    <Suspense fallback={<BackendStatusCard state="loading" />}>
      <BackendStatusResult />
    </Suspense>
  );
}
