import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NOTIFICATION_SETTINGS_PATH } from "@/entities/notification";
import { getViewer, routeFor } from "@/entities/viewer";
import { NotificationSettingsForm } from "@/features/notification-settings";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { AppHeader } from "@/widgets/app-header";

/**
 * `/settings/notifications` (PROTOTYPE, NN-19 #89): which notifications
 * arrive, in the app and by email. Shared with Jay (#102): further settings
 * join `/settings/*` beside this page.
 */
export function NotificationSettingsView() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notification settings</h1>
            <PrototypeBadge />
          </div>
          <p className="text-muted-foreground">Choose what NextNode tells you about, and where.</p>
        </header>
        <PrototypeNotice title="Prototype: notification settings">
          You can try the switches, but saving is under construction, so nothing is kept yet. Notifications under
          the bell are sample data.
        </PrototypeNotice>
        <Suspense fallback={<LoadingCards count={2} label="Loading your notification settings" />}>
          <Settings />
        </Suspense>
      </main>
    </>
  );
}

async function Settings() {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=${encodeURIComponent(NOTIFICATION_SETTINGS_PATH)}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return <LoadError title="We couldn't load your notification settings" message={route.message} />;
  return <NotificationSettingsForm />;
}
