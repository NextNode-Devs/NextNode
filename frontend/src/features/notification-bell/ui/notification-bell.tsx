"use client";

import { BellIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { bellLabel, NOTIFICATION_SETTINGS_PATH, unreadCount } from "@/entities/notification";
import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/shadcn/popover";

import { loadSampleNotifications, useNotifications, type NotificationLoader } from "../model/use-notifications";
import { NotificationList } from "./notification-list";

/**
 * PROTOTYPE (NN-19 #89): the header's bell. Its name carries the unread count
 * ("Notifications, 3 unread"), and a polite live region says when it changes.
 * Radix Popover: Esc or a click outside closes it, and focus returns to the
 * bell. The list is sample data, said so inside the dropdown.
 */
export function NotificationBell({ load = loadSampleNotifications }: { load?: NotificationLoader }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { state, retry, receiveSample } = useNotifications(load);
  const unread = state.status === "ready" ? unreadCount(state.items) : null;

  const receive = () => {
    receiveSample();
    setAnnouncement(`New notification. ${(unread ?? 0) + 1} unread.`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label={bellLabel(unread)} className="relative">
          <BellIcon aria-hidden />
          {unread ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.65rem] leading-4 font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      {/* Speaks only when a notification arrives; the bell's own name carries the count on focus. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-3" aria-labelledby={titleId}>
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-medium">
            Notifications
          </h2>
          <PrototypeBadge />
        </div>
        <p className="text-xs text-muted-foreground">Sample notifications, not your account&apos;s.</p>
        <NotificationList state={state} onRetry={() => void retry()} />
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {state.status === "ready" ? (
            <>
              <Button size="sm" variant="outline" onClick={receive}>
                <SparklesIcon aria-hidden data-icon="inline-start" />
                Show a sample new notification
              </Button>
              {unread ? (
                <Button size="sm" variant="ghost" onClick={() => underConstruction("Mark all as read")}>
                  Mark all as read
                </Button>
              ) : null}
            </>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={NOTIFICATION_SETTINGS_PATH} onClick={() => setOpen(false)}>
              <SettingsIcon aria-hidden data-icon="inline-start" />
              Notification settings
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
