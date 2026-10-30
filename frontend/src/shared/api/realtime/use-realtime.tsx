"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { publicEnv } from "@/shared/config/env.public";

import { RealtimeConnection, type ConnectionState } from "./connection";

const RealtimeContext = createContext<RealtimeConnection | null>(null);

const IDLE: ConnectionState = { status: "connecting" };

/**
 * Opens one authenticated socket for the signed-in user while mounted. Mount
 * it only for users who finished onboarding: the server refuses others (4403).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  // Creating the connection has no side effects; it opens only in the effect.
  const connection = useMemo(
    () =>
      isSignedIn
        ? new RealtimeConnection({
            url: publicEnv.wsUrl,
            getToken: ({ fresh }) => getToken({ skipCache: fresh }),
          })
        : null,
    [getToken, isSignedIn],
  );

  useEffect(() => {
    connection?.start();
    return () => connection?.stop();
  }, [connection]);

  return <RealtimeContext.Provider value={connection}>{children}</RealtimeContext.Provider>;
}

/** The socket (for `on` / `send`) and its live state. `connection` is null outside the provider. */
export function useRealtime(): { connection: RealtimeConnection | null; state: ConnectionState } {
  const connection = useContext(RealtimeContext);
  const subscribe = useCallback(
    (onChange: () => void) => connection?.subscribe(onChange) ?? (() => {}),
    [connection],
  );
  const state = useSyncExternalStore(subscribe, () => connection?.getState() ?? IDLE, () => IDLE);
  return { connection, state };
}
