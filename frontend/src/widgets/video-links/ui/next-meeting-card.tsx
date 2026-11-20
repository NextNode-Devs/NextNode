import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { meetingProvider, nextMeeting, type VideoLink } from "@/entities/video-link";
import { dateChipParts, formatMomentDate, formatWeekdayTime } from "@/shared/lib/format-date";
import { DateChip } from "@/shared/ui/molecules/date-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  links: readonly VideoLink[];
  now: string;
  /** Where "All meetings" goes. */
  allLinksHref: string;
};

/** The soonest dated meeting from the Meetings tab. Renders nothing when none is coming up. */
export function NextMeetingCard({ links, now, allLinksHref }: Props) {
  const meeting = nextMeeting(links, now);
  if (!meeting) return null;
  const starts = meeting.schedule.starts_at;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Next meeting</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-3.5">
          <DateChip {...dateChipParts(starts)} />
          <span aria-hidden className="self-stretch border-l" />
          <div className="min-w-0">
            <p className="font-medium">{meeting.title}</p>
            <p className="text-muted-foreground">
              {formatMomentDate(starts)} · {formatWeekdayTime(starts)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href={meeting.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Join ({meetingProvider(meeting.url)})
            <ExternalLinkIcon className="size-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <Link href={allLinksHref} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            All meetings
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
