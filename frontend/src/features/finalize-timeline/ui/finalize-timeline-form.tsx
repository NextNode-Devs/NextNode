"use client";

import { Loader2Icon, RocketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { finalizeTimeline } from "@/entities/start-gate";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { todayIso } from "@/shared/lib/format-date";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

type Props = {
  projectId: number;
  /** The idea's target delivery date, offered as the starting value. */
  targetDeliveryDate: string;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

type Errors = { start_date?: string; delivery_date?: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function validate(start: string, delivery: string, today: string): Errors {
  const errors: Errors = {};
  if (!ISO_DAY.test(start)) errors.start_date = "Choose a start date.";
  else if (start < today) errors.start_date = "Choose today or a later date.";
  if (!ISO_DAY.test(delivery)) errors.delivery_date = "Choose a delivery date.";
  else if (ISO_DAY.test(start) && delivery <= start) errors.delivery_date = "Choose a date after the start date.";
  return errors;
}

/** A developer idea's Team Lead finalises the timeline, which starts the project. No offer or payment. */
export function FinalizeTimelineForm({ projectId, targetDeliveryDate, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const id = useId();
  const [start, setStart] = useState("");
  const [delivery, setDelivery] = useState(targetDeliveryDate);
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(start, delivery, todayIso());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setBanner("Some fields need attention.");
      return;
    }
    setSending(true);
    setBanner(null);
    const result = await finalizeTimeline(api, projectId, {
      start_date: start,
      delivery_date: delivery,
    });
    setSending(false);
    if (!result.ok) {
      const fields = result.error.fields;
      setErrors({
        start_date: fields?.start_date?.[0],
        delivery_date: fields?.delivery_date?.[0],
      });
      setBanner(result.error.message);
      return;
    }
    setDone(true);
    router.refresh(); // the project is in progress and the workspace chat exists
  };

  if (done) {
    return (
      <p role="status" className="text-sm font-medium">
        Timeline finalised. The project has started.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 id={`${id}-title`} className="font-medium">
          Finalise the timeline
        </h3>
        <p className="text-sm text-muted-foreground">
          This starts the project: the team becomes active and gets its workspace chat.
        </p>
      </div>
      {banner ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-start`} label="Start date" required error={errors.start_date}>
          {(aria) => (
            <Input
              {...aria}
              required
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setErrors((current) => ({ ...current, start_date: undefined }));
              }}
              disabled={sending}
            />
          )}
        </FormField>
        <FormField id={`${id}-delivery`} label="Delivery date" required error={errors.delivery_date}>
          {(aria) => (
            <Input
              {...aria}
              required
              type="date"
              value={delivery}
              onChange={(e) => {
                setDelivery(e.target.value);
                setErrors((current) => ({
                  ...current,
                  delivery_date: undefined,
                }));
              }}
              disabled={sending}
            />
          )}
        </FormField>
      </div>
      <Button type="submit" disabled={sending} className="w-full sm:w-auto">
        {sending ? (
          <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <RocketIcon aria-hidden />
        )}
        {sending ? "Starting…" : "Finalise and start the project"}
      </Button>
    </form>
  );
}
