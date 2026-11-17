"use client";

import { cn } from "cn";
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToToasts,
  type Toast,
  type ToastTone,
} from "@/shared/lib/toast";
import { useMediaQuery } from "@/shared/lib/use-media-query";

const TONE_ICON: Record<ToastTone, typeof InfoIcon> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleXIcon,
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  info: "text-highlight",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

/** Desktop: the toast drops from the top to the middle of the screen. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Renders the queue from `@/shared/lib/toast`. Mount once (app providers).
 *
 * Desktop (≥1024 px): the toast drops in from the top and settles in the
 * middle of the screen (Team Lead, 17 Nov 2026). Phones and tablets: it drops
 * a short distance and stays at the top centre, so it never covers the
 * keyboard or the form being filled in. Reduced motion: fade only.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, getServerToasts);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const reduceMotion = useReducedMotion();

  const from = reduceMotion ? { opacity: 0 } : { opacity: 0, y: isDesktop ? "-45vh" : -32 };
  const leave = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 };

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4",
        isDesktop ? "inset-y-0 justify-center" : "top-4",
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduceMotion}
            initial={from}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={leave}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="pointer-events-auto w-full max-w-sm"
          >
            <ToastCard item={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

function ToastCard({ item }: { item: Toast }) {
  const Icon = TONE_ICON[item.tone];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);

  // Closes itself after `duration`; hovering or focusing it pauses the timer.
  useEffect(() => {
    if (item.duration === 0 || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [item.id, item.duration, paused]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", TONE_ICON_CLASS[item.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss notification"
        className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
