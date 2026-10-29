"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";

import { startDepositCheckout, type CheckoutState } from "../api/start-deposit-checkout";
import { checkoutErrorMessage } from "../model/checkout-error";

type Props = {
  projectId: string;
  label?: string;
  /** Injected in tests; the real action calls the backend and redirects. */
  action?: (projectId: string) => Promise<CheckoutState>;
};

/**
 * Opens Stripe Checkout. Disabled while the request runs, so a double click
 * cannot start two checkouts (the backend also reuses an open session).
 */
export function PayDepositButton({ projectId, label = "Pay deposit", action = startDepositCheckout }: Props) {
  const [state, submit, pending] = useActionState<CheckoutState>(() => action(projectId), null);
  const failure = state?.error ? checkoutErrorMessage(state.error) : null;

  return (
    <form action={submit} className="space-y-3">
      <Button type="submit" size="lg" disabled={pending} aria-disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {pending ? "Opening Stripe Checkout…" : failure?.retry ? "Try again" : label}
        {failure?.retry && !pending ? <RotateCcwIcon aria-hidden /> : null}
      </Button>
      {failure ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
