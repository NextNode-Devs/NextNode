"use client";

import { useCallback, useEffect, useState } from "react";

import {
  decideTeamCandidacy,
  getTeamCandidacy,
  TEAM_UPDATED,
  type TeamCandidacy,
  type TeamDecision,
} from "@/entities/team";
import { useApiClient } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";

export type TeamState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; candidacy: TeamCandidacy };

/** One application or invitation: loaded, refreshed whenever either person decides, and decided on. */
export function useTeamDecisions(candidacyId: string) {
  const api = useApiClient();
  const { connection } = useRealtime();
  const [state, setState] = useState<TeamState>({ status: "loading" });
  const [busy, setBusy] = useState<TeamDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await getTeamCandidacy(api, candidacyId);
    setState(result.ok ? { status: "ready", candidacy: result.data } : { status: "error", message: result.error.message });
  }, [api, candidacyId]);

  useEffect(() => {
    let cancelled = false;
    void getTeamCandidacy(api, candidacyId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ready", candidacy: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [api, candidacyId]);

  // The other person's decisions, and the team filling up, arrive live.
  useEffect(() => {
    if (!connection) return;
    return connection.on(TEAM_UPDATED, (frame) => {
      if (frame.candidacy_id === candidacyId) void refresh();
    });
  }, [connection, candidacyId, refresh]);

  const decide = useCallback(
    async (candidacy: TeamCandidacy, decision: TeamDecision) => {
      setBusy(decision);
      setError(null);
      const result = await decideTeamCandidacy(api, candidacy, decision);
      setBusy(null);
      if (result.ok) setState({ status: "ready", candidacy: result.data });
      else {
        setError(result.error.message);
        void refresh(); // someone else may have taken the last spot first
      }
      return result.ok;
    },
    [api, refresh],
  );

  return { state, busy, error, decide };
}
