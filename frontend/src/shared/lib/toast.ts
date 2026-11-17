/**
 * App-wide toast queue (Phase 2 prototype kit, NN-31).
 *
 * A tiny external store: `toast()` can be called from any event handler, and
 * `<Toaster />` (mounted once in the app providers) renders the queue.
 * Phase 2 decisions: `docs/decisions/phase-2-product-decisions.md`.
 */

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it closes itself. `0` keeps it until dismissed. */
  duration?: number;
};

export type Toast = Required<Omit<ToastInput, "description">> & {
  id: number;
  description?: string;
};

export const DEFAULT_TOAST_DURATION = 4500;
/** Older toasts are dropped beyond this, so the screen never fills up. */
export const MAX_TOASTS = 3;

export const UNDER_CONSTRUCTION_TITLE = "This is a prototype";
export const UNDER_CONSTRUCTION_MESSAGE = "This function is under construction.";

type Listener = () => void;

let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/** Shows a toast and returns its id (for `dismissToast`). */
export function toast(input: ToastInput): number {
  const item: Toast = {
    id: nextId++,
    title: input.title,
    description: input.description,
    tone: input.tone ?? "info",
    duration: input.duration ?? DEFAULT_TOAST_DURATION,
  };
  toasts = [...toasts, item].slice(-MAX_TOASTS);
  emit();
  return item.id;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((item) => item.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

/**
 * The placeholder for every action Phase 2 has not built yet. Use it as the
 * click handler: `onClick={() => underConstruction("Release payment")}`.
 */
export function underConstruction(feature?: string): number {
  return toast({
    title: UNDER_CONSTRUCTION_TITLE,
    description: feature
      ? `${feature}: ${UNDER_CONSTRUCTION_MESSAGE.toLowerCase()}`
      : UNDER_CONSTRUCTION_MESSAGE,
    tone: "info",
  });
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}

const NO_TOASTS: readonly Toast[] = [];

/** Server snapshot: nothing is queued during server rendering. */
export function getServerToasts(): readonly Toast[] {
  return NO_TOASTS;
}

/** Test helper: empties the queue. */
export function resetToasts(): void {
  toasts = [];
  emit();
}
