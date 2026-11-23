"use client";

import { StarIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type KeyboardEvent } from "react";

import { cn } from "@/shared/lib/utils";

import {
  formatStars,
  isNewRatee,
  overallAverage,
  RATER_LABEL,
  totalRatings,
  type RatingStat,
  type RatingSummary,
} from "../model/rating";

type Props = {
  summary: RatingSummary;
  className?: string;
};

/**
 * A developer's rating (NN-35, prototype). Hovering, focusing or tapping it
 * opens a card with a bar for the clients' rating and one for the Team
 * Leads', each with its count; "New, no ratings yet" when there are none.
 * The bars grow with Motion, or appear at once with reduced motion. Escape,
 * moving away or tapping elsewhere closes it.
 */
export function RatingCard({ summary, className }: Props) {
  const cardId = useId();
  const [open, setOpen] = useState(false);
  const fresh = isNewRatee(summary);
  const overall = overallAverage(summary);
  const total = totalRatings(summary);
  const label = fresh || overall === null ? "New, no ratings yet" : `${formatStars(overall)} (${total})`;
  const spoken =
    fresh || overall === null
      ? "New, no ratings yet."
      : `Rated ${formatStars(overall)} out of 5 from ${total} ${total === 1 ? "rating" : "ratings"}.`;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? cardId : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // A tap focuses and opens it; a second tap or a click never closes it by surprise.
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <StarIcon aria-hidden className={cn("size-4", fresh ? "text-muted-foreground" : "fill-current text-amber-500")} />
        <span aria-hidden>{label}</span>
        <span className="sr-only">{spoken} Show the breakdown.</span>
      </button>
      <AnimatePresence>
        {open ? <Breakdown id={cardId} summary={summary} fresh={fresh} /> : null}
      </AnimatePresence>
    </span>
  );
}

function Breakdown({ id, summary, fresh }: { id: string; summary: RatingSummary; fresh: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      id={id}
      role="tooltip"
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
    >
      {fresh ? (
        <p className="text-sm">New, no ratings yet</p>
      ) : (
        <dl className="space-y-3">
          <Bar label={RATER_LABEL.client} stat={summary.from_clients} reduce={Boolean(reduce)} />
          <Bar label={RATER_LABEL.lead} stat={summary.from_leads} reduce={Boolean(reduce)} />
        </dl>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Ratings are given after a project is completed.</p>
    </motion.div>
  );
}

function Bar({ label, stat, reduce }: { label: string; stat: RatingStat; reduce: boolean }) {
  const percent = stat.average === null ? 0 : (stat.average / 5) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <dt>{label}</dt>
        <dd className="text-muted-foreground">
          {stat.average === null
            ? "No ratings yet"
            : `${formatStars(stat.average)} · ${stat.count} ${stat.count === 1 ? "rating" : "ratings"}`}
        </dd>
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          data-testid="rating-bar"
          className="h-full rounded-full bg-amber-500"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
