"use client";

import { Loader2Icon, WifiIcon, WifiOffIcon } from "lucide-react";

import { useRealtime, type ConnectionState } from "@/shared/api/realtime";
import { cn } from "@/shared/lib/utils";

const LABEL: Record<ConnectionState["status"], string> = {
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

/** A small live-updates badge for the header; the full reason is in its tooltip and for screen readers. */
export function ConnectionStatus() {
  const { state } = useRealtime();
  const reason =
    state.status === "offline"
      ? state.reason
      : state.status === "reconnecting"
        ? (state.reason ?? `Reconnecting (attempt ${state.attempt})…`)
        : state.status === "connected"
          ? "Live updates are on."
          : "Connecting to live updates…";
  const Icon = state.status === "connected" ? WifiIcon : state.status === "offline" ? WifiOffIcon : Loader2Icon;

  return (
    <span
      role="status"
      aria-live="polite"
      title={reason}
      data-state={state.status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
        state.status === "connected" && "border-success/40 text-success",
        state.status === "offline" && "border-destructive/40 text-destructive",
        (state.status === "connecting" || state.status === "reconnecting") && "text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          (state.status === "connecting" || state.status === "reconnecting") &&
            "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
      <span>{LABEL[state.status]}</span>
      <span className="sr-only">: {reason}</span>
    </span>
  );
}
