"use client";

import { UserButton } from "@clerk/nextjs";

import { useHydrated } from "@/shared/lib/use-hydrated";

const placeholder = <span className="size-7 rounded-full bg-muted" aria-hidden />;

/**
 * Clerk's account menu, mounted only after hydration. The server renders it
 * empty (Clerk hasn't loaded there), but in the browser Clerk's script can
 * finish loading before React hydrates a busy page, so rendering it straight
 * away made the first browser render differ from the server's HTML (React
 * error #418, seen in the e2e suite under load).
 */
export function AccountMenu() {
  return useHydrated() ? <UserButton /> : placeholder;
}
