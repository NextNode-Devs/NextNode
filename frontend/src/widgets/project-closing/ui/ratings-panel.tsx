"use client";

import { HourglassIcon, StarIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { RatingForm } from "@/features/rate-project";
import {
  RATING_SAMPLE_SITUATIONS,
  SAMPLE_CLIENT_TARGETS,
  SAMPLE_MEMBER_TARGETS,
  type RatingSampleSituation,
  type RatingTarget,
  type RatingValue,
} from "@/entities/rating";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { SamplePicker } from "./sample-picker";

type Props = {
  viewer: "client" | "lead" | "member";
  /** Which sample to open on (tests). */
  initial?: RatingSampleSituation;
};

const SAMPLE_GIVEN: Record<string, RatingValue> = {
  lead: { stars: 5, comment: "Clear updates every week." },
  team: { stars: 4, comment: "" },
  "m-9202": { stars: 5, comment: "Owned the booking flow end to end." },
  "m-9203": { stars: 4, comment: "" },
  "m-9204": { stars: 4, comment: "" },
};

/**
 * Rating after completion (NN-35, prototype). The client rates the Team Lead
 * and the team; the Team Lead rates each member and may write a Team Lead
 * reference. Members are rated, not raters. Nothing is saved.
 */
export function RatingsPanel({ viewer, initial = "open" }: Props) {
  const [situation, setSituation] = useState<RatingSampleSituation>(initial);
  const [given, setGiven] = useState<Record<string, RatingValue> | null>(null);
  const targets: RatingTarget[] = viewer === "client" ? SAMPLE_CLIENT_TARGETS : SAMPLE_MEMBER_TARGETS;

  function choose(next: RatingSampleSituation) {
    setSituation(next);
    setGiven(null);
  }

  const shown = given ?? (situation === "already_rated" ? SAMPLE_GIVEN : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SamplePicker options={RATING_SAMPLE_SITUATIONS} current={situation} onChange={choose} />
        <PrototypeBadge />
      </div>

      {given ? (
        <Alert role="note">
          <AlertTitle>Preview only</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Your ratings are shown here but not saved. Leaving the page resets them.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => choose("open")}>
              Reset the sample
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {viewer === "member" ? (
        <StateCard
          icon={<UsersIcon aria-hidden />}
          title="Your client and Team Lead rate you"
          message="Once the project is completed, the client rates the team and your Team Lead rates each member. Ratings show on your portfolio."
        />
      ) : situation === "not_completed" ? (
        <StateCard
          icon={<HourglassIcon aria-hidden />}
          title="Ratings open when the project is completed"
          message="Every milestone must be approved before anyone can be rated."
        />
      ) : shown ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <h2>Your ratings</h2>
            </CardTitle>
            <CardDescription>Ratings can&apos;t be changed once they&apos;re sent.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {targets.map((t) => (
                <li key={t.key} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {t.name}
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <StarIcon aria-hidden className="size-4 fill-amber-500 text-amber-500" />
                      {shown[t.key]?.stars} of 5
                    </span>
                  </p>
                  {shown[t.key]?.comment ? <p className="text-sm">{shown[t.key].comment}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <section aria-labelledby="rate-heading" className="space-y-3">
          <h2 id="rate-heading" className="text-lg font-semibold">
            {viewer === "client" ? "Rate your Team Lead and the team" : "Rate each member of your team"}
          </h2>
          <RatingForm targets={targets} commentIsReference={viewer === "lead"} onSubmitted={setGiven} />
        </section>
      )}
    </div>
  );
}
