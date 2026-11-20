/**
 * A project's saved meeting link (NN-15b, #92). Planned API shape: the real
 * version is a VideoLink row whose access follows team membership. Calls
 * happen in Zoom, Google Meet or Teams; NextNode only stores the URL.
 */

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const WEEKDAY_PLURAL: Record<Weekday, string> = {
  mon: "Mondays",
  tue: "Tuesdays",
  wed: "Wednesdays",
  thu: "Thursdays",
  fri: "Fridays",
  sat: "Saturdays",
  sun: "Sundays",
};

/** One meeting at a set time, or every week on the chosen days at `time` (24 h "HH:MM", Toronto). */
export type VideoLinkSchedule = { kind: "once"; starts_at: string } | { kind: "weekly"; days: Weekday[]; time: string };

export type VideoLink = {
  id: number;
  project_id: number;
  title: string;
  url: string;
  schedule: VideoLinkSchedule;
  added_by: { account_id: number; display_name: string };
  created_at: string;
};

export type OneOffLink = VideoLink & { schedule: { kind: "once"; starts_at: string } };

export const VIDEO_LINK_LIMITS = { titleMax: 80, urlMax: 500 } as const;

const PROVIDERS: [RegExp, string][] = [
  [/(^|\.)zoom\.us$/, "Zoom"],
  [/^meet\.google\.com$/, "Google Meet"],
  [/(^|\.)teams\.(microsoft|live)\.com$/, "Teams"],
];

/** "Zoom", "Google Meet", "Teams", or "meeting" for anything else (or a bad URL). */
export function meetingProvider(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROVIDERS.find(([pattern]) => pattern.test(host))?.[1] ?? "meeting";
  } catch {
    return "meeting";
  }
}

/** A 24 h "HH:MM" as "10:00 a.m.", the way other meeting times read. Unchanged if it isn't "HH:MM". */
export function formatClockTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour < 12 ? "a.m." : "p.m."}`;
}

/** "Mondays and Thursdays, 10:00 a.m." (days in week order). */
export function describeWeekly(days: readonly Weekday[], time: string): string {
  const names = WEEKDAYS.filter((day) => days.includes(day)).map((day) => WEEKDAY_PLURAL[day]);
  const list = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list}, ${formatClockTime(time)}`;
}

const isOnce = (link: VideoLink): link is OneOffLink => link.schedule.kind === "once";
const startOf = (link: OneOffLink) => Date.parse(link.schedule.starts_at);

export type VideoLinkGroups = { recurring: VideoLink[]; upcoming: OneOffLink[]; past: OneOffLink[] };

/** Recurring links, one-off meetings still to come (soonest first) and past ones (latest first). */
export function groupVideoLinks(links: readonly VideoLink[], now: string): VideoLinkGroups {
  const at = Date.parse(now);
  const once = links.filter(isOnce);
  return {
    recurring: links.filter((link) => link.schedule.kind === "weekly"),
    upcoming: once.filter((link) => startOf(link) >= at).sort((a, b) => startOf(a) - startOf(b)),
    past: once.filter((link) => startOf(link) < at).sort((a, b) => startOf(b) - startOf(a)),
  };
}

/** The soonest one-off meeting still to come, if any. */
export function nextMeeting(links: readonly VideoLink[], now: string): OneOffLink | undefined {
  return groupVideoLinks(links, now).upcoming[0];
}
