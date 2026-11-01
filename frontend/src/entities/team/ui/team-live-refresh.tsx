"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useRealtime } from "@/shared/api/realtime";

import { TEAM_UPDATED } from "../model/frames";

/** Re-renders the server-rendered team and list data whenever a Hire Devs decision arrives live. */
export function TeamLiveRefresh({ projectId }: { projectId?: number }) {
  const router = useRouter();
  const { connection } = useRealtime();

  useEffect(() => {
    if (!connection) return;
    return connection.on(TEAM_UPDATED, (frame) => {
      if (projectId === undefined || frame.project_id === projectId) router.refresh();
    });
  }, [connection, projectId, router]);

  return null;
}
