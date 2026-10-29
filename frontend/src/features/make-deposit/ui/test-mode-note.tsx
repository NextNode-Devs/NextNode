import { InfoIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";

/** Phase 1 runs Stripe in test mode only; say so wherever payment appears. */
export function TestModeNote() {
  return (
    // Informational, not urgent: shadcn's Alert defaults to role="alert".
    <Alert role="note">
      <InfoIcon aria-hidden />
      <AlertTitle>Stripe test mode: no real money moves</AlertTitle>
      <AlertDescription>
        Use test card <span className="font-mono whitespace-nowrap">4242 4242 4242 4242</span>, any future
        expiry date and any CVC.
      </AlertDescription>
    </Alert>
  );
}
