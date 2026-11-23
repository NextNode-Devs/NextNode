"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SAMPLE_NOTIFICATIONS, sampleIncomingNotification, type AppNotification } from "@/entities/notification";
import type { ApiResult } from "@/shared/api/types";
import { toast } from "@/shared/lib/toast";

export type NotificationLoader = () => Promise<ApiResult<AppNotification[]>>;

/** PROTOTYPE: stands in for `GET /api/notifications/` until it exists. */
export const loadSampleNotifications: NotificationLoader = async () => ({ ok: true, data: [...SAMPLE_NOTIFICATIONS] });

export type NotificationsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: AppNotification[] };

/**
 * The bell's list: loaded once after hydration, retried on request. A new
 * notification goes to the top of the list and shows as a toast (NN-31), the
 * way the WebSocket push will deliver it.
 */
export function useNotifications(load: NotificationLoader) {
  const [state, setState] = useState<NotificationsState>({ status: "loading" });
  const incoming = useRef(0);

  const fetchAll = useCallback(async () => {
    setState({ status: "loading" });
    const result = await load();
    setState(result.ok ? { status: "ready", items: result.data } : { status: "error", message: result.error.message });
  }, [load]);

  useEffect(() => {
    let current = true;
    void load().then((result) => {
      if (!current) return;
      setState(result.ok ? { status: "ready", items: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      current = false;
    };
  }, [load]);

  /** PROTOTYPE: what a push would do. `now` is read here, in the handler, never in render. */
  const receiveSample = useCallback(() => {
    const item = sampleIncomingNotification(incoming.current++, new Date().toISOString());
    setState((prev) => (prev.status === "ready" ? { status: "ready", items: [item, ...prev.items] } : prev));
    toast({ title: item.title, description: item.body, tone: "info" });
  }, []);

  return { state, retry: fetchAll, receiveSample };
}
