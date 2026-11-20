import { ExternalLinkIcon, RepeatIcon } from "lucide-react";

import { describeWeekly, meetingProvider, type VideoLink } from "@/entities/video-link";
import { dateChipParts, formatMomentDate, formatWeekdayTime } from "@/shared/lib/format-date";
import { DateChip } from "@/shared/ui/molecules/date-chip";

type Props = { link: VideoLink; past?: boolean };

/** One meeting: the date chip (or a repeat icon), a divider, what and when, then the link out. */
export function MeetingRow({ link, past = false }: Props) {
  const { schedule } = link;
  const once = schedule.kind === "once";
  const when = once
    ? `${formatMomentDate(schedule.starts_at)} · ${formatWeekdayTime(schedule.starts_at)}`
    : describeWeekly(schedule.days, schedule.time);

  return (
    <li className="flex flex-wrap items-center gap-3.5 px-3.5 py-3">
      {once ? (
        <DateChip {...dateChipParts(schedule.starts_at)} muted={past} />
      ) : (
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border">
          <RepeatIcon className="size-4.5 text-muted-foreground" />
        </span>
      )}
      <span aria-hidden className="self-stretch border-l" />
      <div className="min-w-44 flex-1">
        <p className={past ? "font-medium text-muted-foreground" : "font-medium"}>{link.title}</p>
        <p className="text-sm text-muted-foreground">
          {when} · added by {link.added_by.display_name}
        </p>
      </div>
      {past ? null : (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Join ({meetingProvider(link.url)})
          <ExternalLinkIcon className="size-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}
