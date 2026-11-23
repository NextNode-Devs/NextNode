"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { AgreementNote, OfferDetails } from "@/entities/start-gate";
import {
  RESIGN_SITUATION_LABEL,
  SAMPLE_RESIGN_SITUATIONS,
  sampleLeadResign,
  type ResignSituation,
  type ResignViewer,
} from "@/entities/team";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { SamplePicker } from "@/shared/ui/molecules/sample-picker";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { LeadChangeSteps } from "./lead-change-steps";
import { ResignBody } from "./resign-body";
import { SignatureList } from "./signature-list";

type Props = {
  projectId: number;
  viewer: ResignViewer;
  /** Which sample to open on (tests). */
  initial?: ResignSituation;
};

const OPTIONS = SAMPLE_RESIGN_SITUATIONS.map((value) => ({ value, label: RESIGN_SITUATION_LABEL[value] }));

/**
 * The new Lead signs the current offer (NN-38, prototype). Sample data in each
 * situation; the new Lead signs, the client follows along. Nothing is saved.
 */
export function LeadResignPanel({ projectId, viewer, initial = "ready_to_sign" }: Props) {
  const [situation, setSituation] = useState<ResignSituation>(initial);
  const reduceMotion = useReducedMotion();
  const snapshot = sampleLeadResign(situation);
  const base = `/projects/${projectId}`;
  const youId = viewer === "new_lead" ? snapshot.new_lead.account_id : null;
  const showOffer = snapshot.situation !== "awaiting_approval";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SamplePicker options={OPTIONS} current={situation} onChange={setSituation} />
        <PrototypeBadge />
      </div>
      <motion.div
        key={situation}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="min-w-0 space-y-6">
          <ResignBody snapshot={snapshot} viewer={viewer} links={{ team: `${base}/team`, chat: `${base}/chat` }} />
          {showOffer ? (
            <section aria-labelledby="current-offer-heading" className="space-y-3">
              <h2 id="current-offer-heading" className="text-base font-semibold">
                The offer {viewer === "new_lead" && situation === "ready_to_sign" ? "you're signing" : "on this project"}
              </h2>
              <OfferDetails offer={snapshot.offer} proposedBudgetCents={null} />
              <AgreementNote />
            </section>
          ) : null}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <h2>Lead change</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LeadChangeSteps snapshot={snapshot} />
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-medium">Signatures on version {snapshot.offer.version}</h3>
                <SignatureList signatures={snapshot.signatures} youId={youId} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <h2>{snapshot.outgoing_lead.display_name}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                {snapshot.approved_at
                  ? "The former Lead lost access when the client approved the change. Their work, files and messages stay with the project."
                  : "Still the Lead until the client approves the change. Then they lose access straight away."}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/no-access?reason=lead_replaced`}>See what the former Lead sees</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </motion.div>
    </div>
  );
}
