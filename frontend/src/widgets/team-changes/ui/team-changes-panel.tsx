"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import {
  isLeadUnresponsive,
  SAMPLE_TEAM_SITUATIONS,
  sampleTeamChanges,
  type TeamSituation,
  type TeamViewer,
} from "@/entities/team";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";

import { LeadQuietBanner } from "./lead-quiet-banner";
import { NextStepCard } from "./next-step-card";
import { SituationPicker } from "./situation-picker";
import { TeamHistory } from "./team-history";
import { TeamSeats } from "./team-seats";

type Props = {
  projectId: number;
  viewer: TeamViewer;
  /** Which sample to open on (tests). */
  initial?: TeamSituation;
};

/**
 * Lead and member replacement on a client project (NN-38, prototype): sample
 * team data in each situation, with the viewer's own actions. Actions confirm,
 * then say they are under construction; nothing is saved.
 */
export function TeamChangesPanel({ projectId, viewer, initial = "steady" }: Props) {
  const [situation, setSituation] = useState<TeamSituation>(initial);
  const reduceMotion = useReducedMotion();
  const snapshot = sampleTeamChanges(situation);
  const lead = snapshot.seats.find((s) => s.role === "lead");
  const quiet = snapshot.situation !== "lead_proposed" && isLeadUnresponsive(snapshot.lead_last_active_at, snapshot.as_of);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SituationPicker situations={SAMPLE_TEAM_SITUATIONS} current={situation} onChange={setSituation} />
        <PrototypeBadge />
      </div>
      <motion.div
        key={situation}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {quiet && lead ? (
          <LeadQuietBanner
            viewer={viewer}
            leadName={lead.display_name}
            lastActiveAt={snapshot.lead_last_active_at}
            asOf={snapshot.as_of}
            chatHref={`/projects/${projectId}/chat`}
          />
        ) : null}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-6">
            <NextStepCard snapshot={snapshot} viewer={viewer} />
            <TeamHistory history={snapshot.history} />
          </div>
          <TeamSeats snapshot={snapshot} viewer={viewer} />
        </div>
      </motion.div>
    </div>
  );
}
