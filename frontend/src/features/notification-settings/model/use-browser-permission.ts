"use client";

import { useSyncExternalStore } from "react";

/** `null` on the server and during hydration, so both render the same. */
export type BrowserPermission = NotificationPermission | "unsupported" | null;

const subscribeNever = () => () => {};
const readPermission = (): BrowserPermission =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/**
 * Whether this browser lets NextNode show alerts. Read only in the browser,
 * after hydration. Asking for permission is not built yet; this only reports it
 * (a change in the browser's settings shows after a reload).
 */
export function useBrowserPermission(): BrowserPermission {
  return useSyncExternalStore(subscribeNever, readPermission, () => null);
}
