"use client";

import { ArchiveIcon, HourglassIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { GiveFinalApprovalButton } from "@/features/give-final-approval";
import { ContactSupportButton } from "@/features/contact-support";
import {
  approvedMilestones,
  CLOSING_SAMPLE_SITUATIONS,
  closingStage,
  finalApprovalSteps,
  LegalTerms,
  sampleClosing,
  type ClosingSampleSituation,
} from "@/entities/project";
import { formatMomentDate } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Label } from "@/shared/ui/shadcn/label";
import { Switch } from "@/shared/ui/shadcn/switch";

import { MilestoneChecklist, PaymentSummary } from "./closing-parts";
import { SamplePicker } from "./sample-picker";

type Props = {
  projectId: number;
  viewer: "client" | "lead" | "member";
  /** Which sample to open on (tests). */
  initial?: ClosingSampleSituation;
};

/**
 * Final approval of a client project (NN-17, prototype). The client approves
 * the finished project and pays the final payment (PLANNED); the project and
 * team are archived. The Team Lead and members see where it stands. The
 * sample moves on screen so the step can be tried; nothing is saved or paid.
 */
export function FinalApprovalPanel({ projectId, viewer, initial = "awaiting_final_approval" }: Props) {
  const switchId = useId();
  const [situation, setSituation] = useState<ClosingSampleSituation>(initial);
  const [confidential, setConfidential] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const closing = sampleClosing(situation, projectId, confidential);
  const stage = closingStage(closing);
  const archivedHref = `/projects/${projectId}/archived${confidential ? "?confidential=1" : ""}`;

  function choose(next: ClosingSampleSituation) {
    setSituation(next);
    setPreviewed(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SamplePicker options={CLOSING_SAMPLE_SITUATIONS} current={situation} onChange={choose} />
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={confidential} onCheckedChange={setConfidential} />
          <Label htmlFor={switchId}>Sample: confidential project</Label>
        </div>
      </div>

      {previewed ? (
        <Alert role="note">
          <AlertTitle>Preview only</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Nothing was charged and the project was not archived. Leaving the page resets it.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => choose("awaiting_final_approval")}>
              Reset the sample
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {stage === "milestones_open" ? (
        <StateCard
          icon={<HourglassIcon aria-hidden />}
          title="Final approval opens when every milestone is approved"
          message={`${approvedMilestones(closing)} of ${closing.milestones.length} milestones are approved so far.`}
        />
      ) : null}

      {stage === "archived" ? (
        <Alert role="status">
          <ArchiveIcon aria-hidden />
          <AlertTitle>Approved on {formatMomentDate(closing.final_approved_at)}. The project is archived.</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>It&apos;s read-only now, for everyone.</span>
            <Button asChild variant="outline" size="sm">
              <Link href={archivedHref}>Open the archived project</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <MilestoneChecklist closing={closing} />
          {stage !== "milestones_open" ? (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <h2>{stage === "archived" ? "What happened" : "What happens when the client approves"}</h2>
                </CardTitle>
                <PrototypeBadge />
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  {finalApprovalSteps(closing.confidential).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
          {stage === "awaiting_final_approval" ? (
            viewer === "client" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <GiveFinalApprovalButton
                  finalPaymentCents={closing.final_payment_cents}
                  currency={closing.currency}
                  onApproved={() => {
                    setSituation("archived");
                    setPreviewed(true);
                  }}
                />
                <span className="text-sm text-muted-foreground">Something not right?</span>
                <ContactSupportButton />
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <HourglassIcon aria-hidden className="size-4" />
                Every milestone is approved. Waiting for the client&apos;s final approval.
              </p>
            )
          ) : null}
        </div>
        <aside className="space-y-4">
          <PaymentSummary closing={closing} paid={stage === "archived"} />
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <h2>Code ownership</h2>
              </CardTitle>
              <PrototypeBadge />
            </CardHeader>
            <CardContent>
              <LegalTerms layout="stacked" confidential={closing.confidential} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
