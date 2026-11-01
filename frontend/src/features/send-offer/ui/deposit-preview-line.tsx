import { Loader2Icon } from "lucide-react";

import { formatMoney } from "@/shared/lib/format-money";

import type { PreviewState } from "../model/use-deposit-preview";

/** The server's deposit for the total being typed. Announced politely as it updates. */
export function DepositPreviewLine({ state }: { state: PreviewState }) {
  return (
    <div aria-live="polite" className="rounded-md bg-muted px-3 py-2 text-sm">
      {state.kind === "ready" ? (
        <p>
          <span className="text-muted-foreground">Deposit due at project start: </span>
          <span className="font-semibold">{formatMoney(state.preview.deposit_cents, state.preview.currency)}</span>
          <span className="text-muted-foreground"> ({state.preview.deposit_percent} % of the offer total)</span>
        </p>
      ) : state.kind === "loading" ? (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          Calculating the deposit…
        </p>
      ) : state.kind === "error" ? (
        <p className="text-destructive">We couldn&apos;t calculate the deposit: {state.message}</p>
      ) : (
        <p className="text-muted-foreground">Enter a total to see the deposit the client pays at project start.</p>
      )}
    </div>
  );
}
