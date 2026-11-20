import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Use it to render
 * something that only exists in the browser (a third-party widget whose first
 * render depends on a script that may or may not have loaded yet) without a
 * hydration mismatch: render a placeholder until it is true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
