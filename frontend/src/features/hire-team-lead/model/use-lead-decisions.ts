"use client";

import { useCallback, useEffect, useState } from "react";

import {
  decideLeadCandidacy,
  getLeadCandidacy,
  LEAD_UPDATED,
  type LeadCandidacy,
  type LeadDecision,
} from "@/entities/lead-candidacy";
import { useApiClient } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";

export type LeadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; candidacy: LeadCandidacy };

/** One application or invitation: loaded, refreshed whenever either person decides, and decided on. */
export function useLeadDecisions(candidacyId: string) {
  const api = useApiClient();
  const { connection } = useRealtime();
  const [state, setState] = useState<LeadState>({ status: "loading" });
  const [busy, setBusy] = useState<LeadDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await getLeadCandidacy(api, candidacyId);
    setState(result.ok ? { status: "ready", candidacy: result.data } : { status: "error", message: result.error.message });
  }, [api, candidacyId]);

  useEffect(() => {
    let cancelled = false;
    void getLeadCandidacy(api, candidacyId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", candidacy: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [api, candidacyId]);

  // The other person's decisions arrive live.
  useEffect(() => {
    if (!connection) return;
    return connection.on(LEAD_UPDATED, (frame) => {
      if (frame.candidacy_id === candidacyId) void refresh();
    });
  }, [connection, candidacyId, refresh]);

  const decide = useCallback(
    async (decision: LeadDecision) => {
      setBusy(decision);
      setError(null);
      const result = await decideLeadCandidacy(api, candidacyId, decision);
      setBusy(null);
      if (result.ok) setState({ status: "ready", candidacy: result.data });
      else {
        setError(result.error.message);
        void refresh(); // someone else may have decided first
      }
      return result.ok;
    },
    [api, candidacyId, refresh],
  );

  return { state, busy, error, decide };
}
