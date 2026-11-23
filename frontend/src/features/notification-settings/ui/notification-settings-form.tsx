"use client";

import { useId, useState, type FormEvent } from "react";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CATEGORIES,
  type Channel,
  type NotificationCategory,
  type NotificationSettings,
} from "@/entities/notification";
import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Switch } from "@/shared/ui/shadcn/switch";

import { useBrowserPermission } from "../model/use-browser-permission";
import { BrowserAlerts } from "./browser-alerts";

const CHANNEL_LABEL: Record<Channel, string> = { in_app: "In the app", email: "Email" };

type Props = { initial?: NotificationSettings };

/**
 * PROTOTYPE (NN-19 #89): which notifications arrive, in the app and by email.
 * Switches change on screen; saving is under construction, so nothing is kept.
 */
export function NotificationSettingsForm({ initial = DEFAULT_NOTIFICATION_SETTINGS }: Props) {
  const id = useId();
  const [settings, setSettings] = useState(initial);
  const permission = useBrowserPermission();

  const set = (category: NotificationCategory, channel: Channel, on: boolean) =>
    setSettings((prev) => ({ ...prev, [category]: { ...prev[category], [channel]: on } }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    underConstruction("Save notification settings");
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Notification settings">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <h2>What you hear about</h2>
          </CardTitle>
          <CardDescription>
            Choose, for each kind, whether it shows under the bell and whether it&apos;s also emailed to your account
            address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <li key={category.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 id={`${id}-${category.id}`} className="text-sm font-medium">
                    {category.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
                <div role="group" aria-labelledby={`${id}-${category.id}`} className="flex shrink-0 gap-6">
                  {(["in_app", "email"] as const).map((channel) => {
                    const switchId = `${id}-${category.id}-${channel}`;
                    return (
                      <span key={channel} className="flex min-h-9 items-center gap-2">
                        <Switch
                          id={switchId}
                          checked={settings[category.id][channel]}
                          onCheckedChange={(on) => set(category.id, channel, on)}
                          aria-label={`${category.label}: ${CHANNEL_LABEL[channel]}`}
                        />
                        <label htmlFor={switchId} className="text-sm" aria-hidden>
                          {CHANNEL_LABEL[channel]}
                        </label>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <h2>Alerts in this browser</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BrowserAlerts permission={permission} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save settings</Button>
        <Button type="button" variant="outline" onClick={() => setSettings(DEFAULT_NOTIFICATION_SETTINGS)}>
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}
