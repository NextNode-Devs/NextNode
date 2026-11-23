"use client";

import { CheckIcon, LockIcon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import {
  ACCESS_REMOVAL_LABEL,
  CLOSED_TO_FORMER_MEMBERS,
  SAMPLE_ACCESS_REMOVAL_REASONS,
  sampleAccessRemoval,
  type AccessRemoval,
  type AccessRemovalReason,
} from "@/entities/team";
import { ContactSupportButton } from "@/features/contact-support";
import { formatMessageTime } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { SamplePicker } from "@/shared/ui/molecules/sample-picker";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = { initial?: AccessRemovalReason };

const OPTIONS = SAMPLE_ACCESS_REMOVAL_REASONS.map((value) => ({ value, label: ACCESS_REMOVAL_LABEL[value] }));

/** Why access ended, in words that fit how it ended. */
function reasonText(removal: AccessRemoval): string {
  const when = formatMessageTime(removal.ended_at);
  switch (removal.reason) {
    case "left":
      return `You left the team ${when}. Everyone on the team and the client was told.`;
    case "removed":
      return `${removal.by ?? "The Team Lead"} (Team Lead) removed you from the team ${when}. Everyone on the team and the client was told.`;
    case "lead_replaced":
      return `You didn't respond in the project for 3 days, so the team proposed ${removal.by ?? "a new Lead"} and the client approved them ${when}. They lead the project now.`;
  }
}

function keptItems(removal: AccessRemoval): string[] {
  const items = [
    "Your messages, files and updates stay with the project, so the team can finish the work.",
    "The project stays on your dashboard, marked as no access.",
  ];
  if (removal.reason === "lead_replaced") items.push("Your signature on the offer stays on record next to the new Lead's.");
  return items;
}

/**
 * "You no longer have access to this project" (NN-38, prototype): sample data
 * for each way access ends, what closes, what stays and where to go next.
 */
export function AccessRemovedPanel({ initial = "removed" }: Props) {
  const [reason, setReason] = useState<AccessRemovalReason>(initial);
  const reduceMotion = useReducedMotion();
  const removal = sampleAccessRemoval(reason);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SamplePicker label="Sample reason" options={OPTIONS} current={reason} onChange={setReason} />
        <PrototypeBadge />
      </div>
      <motion.div
        key={reason}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LockIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="min-w-0 break-words">{removal.project.title}</h2>
            </CardTitle>
            <p className="text-sm">{reasonText(removal)}</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="grid gap-6 sm:grid-cols-2">
              <section aria-labelledby="closed-heading" className="space-y-2">
                <h3 id="closed-heading" className="font-medium">
                  Closed to you now
                </h3>
                <ul className="space-y-1.5">
                  {CLOSED_TO_FORMER_MEMBERS.map((part) => (
                    <li key={part} className="flex items-start gap-2 text-muted-foreground">
                      <XIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {part}
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="kept-heading" className="space-y-2">
                <h3 id="kept-heading" className="font-medium">
                  What stays
                </h3>
                <ul className="space-y-1.5">
                  {keptItems(removal).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button asChild>
                  <Link href="/dashboard">Go to your dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/projects">Find another project</Link>
                </Button>
              </div>
              <p className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
                Think this is a mistake? <ContactSupportButton />
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
