import { BellOffIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";

import { CATEGORY_LABEL } from "@/entities/notification";
import { formatMessageTime } from "@/shared/lib/format-date";
import { underConstruction } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import type { NotificationsState } from "../model/use-notifications";

/** The dropdown's body: loading, error, empty or the list, newest first. */
export function NotificationList({ state, onRetry }: { state: NotificationsState; onRetry: () => void }) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading notifications" className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="space-y-2">
        <p className="flex items-start gap-2 text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          We couldn&apos;t load your notifications. {state.message}
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCwIcon aria-hidden data-icon="inline-start" />
          Try again
        </Button>
      </div>
    );
  }
  if (state.items.length === 0) {
    return (
      <p className="flex items-start gap-2 py-2 text-muted-foreground">
        <BellOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        No notifications yet. Applications, milestones and team changes will show up here.
      </p>
    );
  }
  return (
    <ul aria-label="Notifications, newest first" className="-mx-1 max-h-80 divide-y overflow-y-auto">
      {state.items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => underConstruction("Open notification")}
            className="flex w-full items-start gap-2 rounded-md px-1 py-2 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")}
            />
            <span className="min-w-0 space-y-0.5">
              <span className={cn("block break-words", !item.read && "font-semibold")}>
                {item.read ? null : <span className="sr-only">Unread: </span>}
                {item.title}
              </span>
              <span className="block text-muted-foreground">{item.body}</span>
              <span className="block text-xs text-muted-foreground">
                {CATEGORY_LABEL[item.category]} · {formatMessageTime(item.created_at)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
