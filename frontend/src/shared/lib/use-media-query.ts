"use client";

import { useSyncExternalStore } from "react";

/**
 * `true` while the media query matches. Always `false` on the server and in
 * environments without `matchMedia` (jsdom), so the first render is the
 * mobile layout and never causes a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}
