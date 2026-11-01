"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { acceptOffer, AgreementNote, declineOffer, OFFER_LIMITS, type Offer } from "@/entities/start-gate";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

type Props = {
  /** The open version; the card above shows its terms. */
  offer: Offer;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

type Outcome = "accepted" | "declined" | null;

/** The project's client accepts the open version, or declines it with a reason the Team Lead sees. */
export function DecideOffer({ offer, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const finish = (result: Awaited<ReturnType<typeof acceptOffer>>, done: Outcome) => {
    setPending(null);
    if (!result.ok) {
      setReasonError(result.error.fields?.reason?.[0] ?? null);
      setError(result.error.message);
      return;
    }
    setOutcome(done);
    router.refresh(); // the gate moves on, for whoever's turn it is now
  };

  const accept = async () => {
    setPending("accept");
    setError(null);
    finish(await acceptOffer(api, offer.id), "accepted");
  };

  const decline = async (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setReasonError("Say why you're declining.");
      return;
    }
    if (text.length > OFFER_LIMITS.reason) {
      setReasonError(`Up to ${OFFER_LIMITS.reason} characters.`);
      return;
    }
    setPending("decline");
    setError(null);
    finish(await declineOffer(api, offer.id, text), "declined");
  };

  if (outcome) {
    return (
      <p role="status" className="text-sm font-medium">
        {outcome === "accepted"
          ? `You accepted version ${offer.version}. Next, pay the deposit to start the project.`
          : `You declined version ${offer.version}. The Team Lead can send a revised offer.`}
      </p>
    );
  }

  const busy = pending !== null;
  return (
    <div className="space-y-3">
      <AgreementNote />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {declining ? (
        <form onSubmit={decline} noValidate className="space-y-3">
          <FormField
            id={`${id}-reason`}
            label="Why are you declining?"
            required
            error={reasonError ?? undefined}
            hint="The Team Lead sees this and can send a revised version. You can also talk it through in your chat."
          >
            {(aria) => (
              <Textarea
                {...aria}
                required
                rows={3}
                maxLength={OFFER_LIMITS.reason}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                disabled={busy}
              />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={busy}>
              {pending === "decline" ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {pending === "decline" ? "Declining…" : `Decline version ${offer.version}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDeclining(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={accept} disabled={busy}>
            {pending === "accept" ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <CheckIcon aria-hidden />
            )}
            {pending === "accept" ? "Accepting…" : `Accept version ${offer.version}`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDeclining(true)} disabled={busy}>
            Decline…
          </Button>
        </div>
      )}
    </div>
  );
}
