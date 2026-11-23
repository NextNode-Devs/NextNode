"use client";

import { FlagIcon, PartyPopperIcon } from "lucide-react";
import { useState } from "react";

import {
  applyMilestoneAction,
  MILESTONE_SAMPLE_SITUATIONS,
  reviewsFor,
  sampleMilestoneSituation,
  startNextMilestone,
  type DepositReleaseChoice,
  type Milestone,
  type MilestoneAction,
  type MilestoneSample,
  type MilestoneSampleSituation,
  type MilestoneViewer,
} from "@/entities/milestone";
import { toast, underConstruction } from "@/shared/lib/toast";
import { LoadError } from "@/shared/ui/load-states";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";

import { MilestoneCard } from "./milestone-card";
import { SamplePicker } from "./sample-picker";

type Situation = MilestoneSampleSituation | "load_error";

const SITUATIONS: { value: Situation; label: string }[] = [
  ...MILESTONE_SAMPLE_SITUATIONS,
  { value: "load_error", label: "Couldn't load" },
];

type Props = {
  viewer: MilestoneViewer;
  /** Who acts in the sample history when this viewer does something. */
  viewerName: string;
  depositReleaseMilestone: DepositReleaseChoice | null;
  /** Which sample to open on (tests). */
  initial?: Situation;
};

/**
 * Milestone delivery and review (NN-16b, prototype): the Team Lead submits
 * work, the client approves it or asks for changes, and the loop repeats.
 * Actions move the sample on screen so the loop can be tried, and say that
 * they are under construction: nothing is saved.
 */
export function MilestoneReviewPanel({ viewer, viewerName, depositReleaseMilestone, initial = "under_review" }: Props) {
  const [situation, setSituation] = useState<Situation>(initial);
  const [sample, setSample] = useState<MilestoneSample>(() => sampleOf(initial));
  const [changed, setChanged] = useState(false);
  const [focus, setFocus] = useState<{ id: number; n: number }>({ id: 0, n: 0 });

  function choose(next: Situation) {
    setSituation(next);
    setSample(sampleOf(next));
    setChanged(false);
  }

  function act(milestone: Milestone, action: MilestoneAction, note: string, link: string | null) {
    const result = applyMilestoneAction(milestone, {
      action,
      viewer,
      note,
      link_url: link,
      author_name: viewerName,
      at: new Date().toISOString(),
      review_id: Date.now(),
    });
    if (!result.ok) {
      toast({ title: "That can't be done", description: result.reason, tone: "error" });
      return;
    }
    const replaced = sample.milestones.map((m) => (m.id === milestone.id ? result.milestone : m));
    setSample({
      milestones: action === "approve" ? startNextMilestone(replaced) : replaced,
      reviews: [...sample.reviews, result.review],
    });
    setChanged(true);
    setFocus((f) => ({ id: milestone.id, n: f.n + 1 }));
  }

  const { milestones } = sample;
  const done = milestones.filter((m) => m.status === "completed").length;
  const allDone = milestones.length > 0 && done === milestones.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SamplePicker options={SITUATIONS} current={situation} onChange={choose} />
        <PrototypeBadge />
      </div>

      {changed ? (
        <Alert role="note">
          <AlertTitle>Preview only</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>This change is shown here but not saved. Leaving the page resets it.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => choose(situation)}>
              Reset the sample
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {situation === "load_error" ? (
        <LoadError title="We couldn't load the milestones" message="Check your connection and refresh the page." />
      ) : milestones.length === 0 ? (
        <StateCard
          icon={<FlagIcon aria-hidden />}
          title="No milestones yet"
          message={
            viewer === "client"
              ? "Milestones come with the Team Lead's offer. You'll see them here once you accept it."
              : "Milestones are set in the offer to the client. They appear here once the client accepts it."
          }
        />
      ) : (
        <section aria-labelledby="milestones-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="milestones-heading" className="text-lg font-semibold">
              Milestones
            </h2>
            <p className="text-sm text-muted-foreground">
              {done} of {milestones.length} approved
            </p>
          </div>
          {allDone ? (
            <StateCard
              icon={<PartyPopperIcon aria-hidden />}
              title="Every milestone is approved"
              message={
                viewer === "client"
                  ? "Give final approval to finish the project and make the final payment."
                  : "The client gives final approval to finish the project."
              }
              action={
                viewer === "client" ? (
                  <Button type="button" onClick={() => underConstruction("Final approval")}>
                    Give final approval
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          <ol className="space-y-4">
            {milestones.map((milestone) => (
              <li key={milestone.id}>
                <MilestoneCard
                  milestone={milestone}
                  reviews={reviewsFor(sample.reviews, milestone.id)}
                  viewer={viewer}
                  releasesDeposit={milestone.sequence === depositReleaseMilestone}
                  onAction={act}
                  focusRequest={focus.id === milestone.id ? focus.n : 0}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function sampleOf(situation: Situation): MilestoneSample {
  return situation === "load_error" ? { milestones: [], reviews: [] } : sampleMilestoneSituation(situation);
}
