/**
 * The one way to show a date or time. An explicit locale and time zone keep
 * the server and the browser in agreement (no hydration mismatch). Phase 1
 * shows Toronto time, where the team and its demo run.
 */
export const DISPLAY_TIME_ZONE = "America/Toronto";
const LOCALE = "en-CA";

const timeOfDay = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dayAndTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const calendarDay = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Oct 30, 10:42 a.m.", or just "10:42 a.m." when `reference` is the same day. Empty for a bad value. */
export function formatMessageTime(iso: string | null | undefined, reference?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (reference) {
    const other = new Date(reference);
    if (!Number.isNaN(other.getTime()) && calendarDay.format(other) === calendarDay.format(date)) {
      return timeOfDay.format(date);
    }
  }
  return dayAndTime.format(date);
}
