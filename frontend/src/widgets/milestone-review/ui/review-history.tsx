import { ExternalLinkIcon } from "lucide-react";

import { REVIEW_KIND_LABEL, type MilestoneReview } from "@/entities/milestone";
import { formatMessageTime } from "@/shared/lib/format-date";

/** One milestone's submissions, requested changes and approval, oldest first. */
export function ReviewHistory({ reviews }: { reviews: MilestoneReview[] }) {
  if (reviews.length === 0) return <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>;
  return (
    <ol className="space-y-3 border-l pl-4">
      {reviews.map((review) => (
        <li key={review.id} className="relative text-sm">
          <span
            aria-hidden
            className={
              review.kind === "revision_requested"
                ? "absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-muted-foreground bg-background"
                : "absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground"
            }
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{REVIEW_KIND_LABEL[review.kind]}</span> by {review.author_name}
            {review.author_role === "lead" ? " (Team Lead)" : " (client)"} ·{" "}
            <time dateTime={review.created_at}>{formatMessageTime(review.created_at)}</time>
          </p>
          {review.note ? <p className="mt-0.5 break-words whitespace-pre-line">{review.note}</p> : null}
          {review.link_url ? (
            <a
              href={review.link_url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 rounded-sm break-all underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {review.link_url}
              <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
