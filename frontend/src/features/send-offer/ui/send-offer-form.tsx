"use client";

import { Loader2Icon, SignatureIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { parseBudget } from "@/entities/project";
import { AgreementNote, sendOffer, type Offer, type OfferBody } from "@/entities/start-gate";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { todayIso } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import {
  draftFromOffer,
  offerErrorsFromApi,
  toOfferBody,
  validateOffer,
  type OfferDraft,
  type OfferErrors,
} from "../model/offer-draft";
import { useDepositPreview } from "../model/use-deposit-preview";
import { DepositPreviewLine } from "./deposit-preview-line";

type Props = {
  projectId: number;
  /** The client's listing budget: a proposal, shown so the Lead can negotiate from it. */
  proposedBudgetCents: number;
  /** The version the client declined, if any: the revision starts from it. */
  declined?: Offer;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

const FIELD_FOR: Record<keyof OfferDraft, keyof OfferBody> = {
  summary: "summary",
  total: "total_cents",
  start_date: "start_date",
  delivery_date: "delivery_date",
};

/** The Team Lead writes the estimate, total and timeline, then signs and sends it to the client. */
export function SendOfferForm({ projectId, proposedBudgetCents, declined, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState<OfferDraft>(() => draftFromOffer(declined));
  const [errors, setErrors] = useState<OfferErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const preview = useDepositPreview(api, projectId, parseBudget(draft.total));

  const update = (key: keyof OfferDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [FIELD_FOR[key]]: undefined })); // clear as they edit
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateOffer(draft, todayIso());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setBanner("Some fields need attention.");
      return;
    }
    setSending(true);
    setBanner(null);
    const result = await sendOffer(api, projectId, toOfferBody(draft));
    setSending(false);
    if (!result.ok) {
      setErrors(offerErrorsFromApi(result.error.fields));
      setBanner(result.error.message);
      return;
    }
    setSent(true);
    router.refresh(); // the offer appears in the history and the client's turn begins
  };

  if (sent) {
    return (
      <p role="status" className="text-sm font-medium">
        Offer signed and sent. The client can now review it.
      </p>
    );
  }

  const field = (key: keyof OfferBody) => `${id}-${key}`;
  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 id={`${id}-title`} className="font-medium">
          {declined ? `Send a revised offer (version ${declined.version + 1})` : "Send the client an offer"}
        </h3>
        <p className="text-sm text-muted-foreground">
          The client proposed {formatMoney(proposedBudgetCents, "cad")}. That was a starting point; your offer sets the
          total.
        </p>
      </div>
      {banner ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        id={field("summary")}
        label="Estimate summary"
        required
        error={errors.summary}
        hint="What the team will deliver and how the work is split."
      >
        {(aria) => (
          <Textarea
            {...aria}
            required
            rows={4}
            value={draft.summary}
            onChange={(e) => update("summary", e.target.value)}
            disabled={sending}
          />
        )}
      </FormField>
      <FormField
        id={field("total_cents")}
        label="Offer total (CAD)"
        required
        error={errors.total_cents}
        hint="At least CAD 1,500.00."
      >
        {(aria) => (
          <Input
            {...aria}
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="10,000.00"
            value={draft.total}
            onChange={(e) => update("total", e.target.value)}
            disabled={sending}
          />
        )}
      </FormField>
      <DepositPreviewLine state={preview} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={field("start_date")} label="Start date" required error={errors.start_date}>
          {(aria) => (
            <Input
              {...aria}
              required
              type="date"
              value={draft.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              disabled={sending}
            />
          )}
        </FormField>
        <FormField id={field("delivery_date")} label="Delivery date" required error={errors.delivery_date}>
          {(aria) => (
            <Input
              {...aria}
              required
              type="date"
              value={draft.delivery_date}
              onChange={(e) => update("delivery_date", e.target.value)}
              disabled={sending}
            />
          )}
        </FormField>
      </div>
      <AgreementNote />
      <Button type="submit" disabled={sending} className="w-full sm:w-auto">
        {sending ? (
          <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <SignatureIcon aria-hidden />
        )}
        {sending ? "Signing and sending…" : "Sign and send offer"}
      </Button>
    </form>
  );
}
