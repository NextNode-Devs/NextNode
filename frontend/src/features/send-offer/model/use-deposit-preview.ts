"use client";

import { useEffect, useState } from "react";

import { PROJECT_LIMITS } from "@/entities/project";
import { previewDeposit, type DepositPreview } from "@/entities/start-gate";
import type { BrowserApi } from "@/shared/api/browser-client";

export type PreviewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; preview: DepositPreview }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 400;

/**
 * The deposit the server would ask for `totalCents`, fetched as the Lead
 * types. The browser never computes it. Idle until the total is a valid amount.
 */
export function useDepositPreview(api: BrowserApi, projectId: number, totalCents: number | null): PreviewState {
  const valid =
    totalCents !== null && totalCents >= PROJECT_LIMITS.minBudgetCents && totalCents <= PROJECT_LIMITS.maxBudgetCents;
  const [state, setState] = useState<PreviewState>({ kind: "idle" });

  useEffect(() => {
    if (!valid || totalCents === null) return;
    let current = true;
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      const result = await previewDeposit(api, projectId, totalCents);
      if (!current) return; // a newer total replaced this one
      setState(result.ok ? { kind: "ready", preview: result.data } : { kind: "error", message: result.error.message });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, projectId, totalCents, valid]);

  if (!valid) return { kind: "idle" };
  // Never show the deposit of a total the Lead has since changed.
  if (state.kind === "ready" && state.preview.total_cents !== totalCents) return { kind: "loading" };
  return state.kind === "idle" ? { kind: "loading" } : state;
}
