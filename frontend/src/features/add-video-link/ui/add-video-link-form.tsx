"use client";

import { useId, useState, type FormEvent } from "react";

import { WEEKDAY_SHORT, WEEKDAYS, type Weekday } from "@/entities/video-link";
import { DISPLAY_TIME_ZONE_LABEL } from "@/shared/lib/format-date";
import { underConstruction } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Checkbox } from "@/shared/ui/shadcn/checkbox";
import { Input } from "@/shared/ui/shadcn/input";
import { Label } from "@/shared/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

import { checkVideoLink, EMPTY_VIDEO_LINK, type VideoLinkDraft, type VideoLinkErrors } from "../model/check-video-link";

/**
 * "Add a link" (prototype, #92). Checks the fields like the planned API would,
 * then says the action is under construction: nothing is saved yet.
 */
export function AddVideoLinkForm() {
  const id = useId();
  const [draft, setDraft] = useState<VideoLinkDraft>(EMPTY_VIDEO_LINK);
  const [errors, setErrors] = useState<VideoLinkErrors>({});

  function set<K extends keyof VideoLinkDraft>(key: K, value: VideoLinkDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    const field = key === "kind" ? null : (key as keyof VideoLinkErrors);
    if (field && errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleDay(day: Weekday, on: boolean) {
    set("days", on ? [...draft.days, day] : draft.days.filter((d) => d !== day));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = checkVideoLink(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    underConstruction("Add video link");
  }

  const recurring = draft.kind === "weekly";
  const daysError = errors.days ? `${id}-days-error` : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Add a link</h2>
        </CardTitle>
        <CardDescription>Only the client and the Team Lead can add meeting links. Everyone on the project can see and join them.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="space-y-4">
          <FormField id={`${id}-title`} label="Name" required error={errors.title}>
            {(aria) => (
              <Input {...aria} required placeholder="e.g. Sprint review" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            )}
          </FormField>
          <FormField id={`${id}-url`} label="Meeting link" required error={errors.url} hint="Zoom, Google Meet or Teams. The call happens there.">
            {(aria) => (
              <Input
                {...aria}
                required
                type="url"
                inputMode="url"
                placeholder="https://meet.google.com/…"
                value={draft.url}
                onChange={(e) => set("url", e.target.value)}
              />
            )}
          </FormField>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">How often</legend>
            <RadioGroup value={draft.kind} onValueChange={(value) => set("kind", value as VideoLinkDraft["kind"])}>
              <div className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-once`} value="once" />
                <Label htmlFor={`${id}-once`} className="font-normal">
                  One meeting
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id={`${id}-weekly`} value="weekly" />
                <Label htmlFor={`${id}-weekly`} className="font-normal">
                  Recurring
                </Label>
              </div>
            </RadioGroup>
          </fieldset>

          {recurring ? (
            <fieldset className="space-y-2" aria-describedby={daysError}>
              <legend className="mb-2 text-sm font-medium">
                Days <span aria-hidden className="text-destructive">*</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <Label
                    key={day}
                    htmlFor={`${id}-${day}`}
                    className={cn(
                      "min-h-9 cursor-pointer rounded-md border px-2.5 font-normal has-data-checked:border-primary",
                      // The focused day gets its own ring, which stays visible in the error state too
                      // (the error marks the chips' borders, not every checkbox's ring).
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      errors.days ? "border-destructive" : null,
                    )}
                  >
                    <Checkbox
                      id={`${id}-${day}`}
                      checked={draft.days.includes(day)}
                      onCheckedChange={(checked) => toggleDay(day, checked === true)}
                    />
                    {WEEKDAY_SHORT[day]}
                  </Label>
                ))}
              </div>
              {errors.days ? (
                <p id={daysError} className="text-sm text-destructive">
                  {errors.days}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <FormField id={`${id}-date`} label="Date" required error={errors.date}>
              {(aria) => <Input {...aria} required type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />}
            </FormField>
          )}

          <FormField
            id={`${id}-time`}
            label="Time"
            required
            error={errors.time}
            hint={
              recurring
                ? `In ${DISPLAY_TIME_ZONE_LABEL}. Recurring meetings repeat every week on the days you pick, so they have no single date.`
                : `In ${DISPLAY_TIME_ZONE_LABEL}.`
            }
          >
            {(aria) => <Input {...aria} required type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} />}
          </FormField>

          <Button type="submit" className="w-full">
            Add link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
