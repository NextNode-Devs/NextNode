"use client";

import { BellRingIcon, CircleCheckIcon, LockIcon, MonitorXIcon } from "lucide-react";
import type { ReactNode } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import type { BrowserPermission } from "../model/use-browser-permission";

/** Alerts outside the tab. Denied is the browser's decision, so the way out is the browser's settings. */
export function BrowserAlerts({ permission }: { permission: BrowserPermission }) {
  if (permission === null) {
    return (
      <div role="status" aria-label="Checking this browser">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  switch (permission) {
    case "denied":
      return (
        <Line icon={<LockIcon aria-hidden />} tone="text-destructive">
          <strong className="font-medium">This browser has blocked notifications from NextNode.</strong> To get
          alerts, allow notifications for this site in your browser&apos;s settings, then reload this page.
        </Line>
      );
    case "granted":
      return (
        <Line icon={<CircleCheckIcon aria-hidden />} tone="text-success">
          This browser allows alerts from NextNode.
        </Line>
      );
    case "unsupported":
      return (
        <Line icon={<MonitorXIcon aria-hidden />}>
          This browser can&apos;t show alerts. You&apos;ll still see notifications under the bell.
        </Line>
      );
    default:
      return (
        <div className="space-y-2">
          <Line icon={<BellRingIcon aria-hidden />}>Get an alert even when NextNode isn&apos;t the open tab.</Line>
          <Button size="sm" variant="outline" onClick={() => underConstruction("Turn on browser alerts")}>
            Turn on browser alerts
          </Button>
        </div>
      );
  }
}

function Line({ icon, tone, children }: { icon: ReactNode; tone?: string; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 shrink-0 [&_svg]:size-4 ${tone ?? "text-muted-foreground"}`}>{icon}</span>
      <span>{children}</span>
    </p>
  );
}
