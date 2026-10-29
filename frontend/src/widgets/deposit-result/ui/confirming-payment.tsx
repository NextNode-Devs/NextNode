"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RefreshButton } from "./refresh-button";

export const POLL_MS = 3_000;
export const STILL_WAITING_AFTER_MS = 60_000;

/**
 * Shown while the server still reports the deposit as pending. It re-renders
 * the page from the server every few seconds; only the server's answer can
 * turn this into "confirmed". Returning from Stripe changes nothing itself.
 */
export function ConfirmingPayment() {
  const router = useRouter();
  const [stillWaiting, setStillWaiting] = useState(false);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), POLL_MS);
    const slow = setTimeout(() => setStillWaiting(true), STILL_WAITING_AFTER_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(slow);
    };
  }, [router]);

  return (
    <div className="space-y-4">
      <p role="status" className="flex items-center gap-2 font-medium">
        <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Confirming payment…
      </p>
      {stillWaiting ? (
        <>
          <p className="text-sm text-muted-foreground">
            Still waiting for Stripe to confirm. This page will update; nothing has been charged twice.
          </p>
          <RefreshButton />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Stripe is confirming your payment with us. This usually takes a few seconds; you can stay on this
          page.
        </p>
      )}
    </div>
  );
}
