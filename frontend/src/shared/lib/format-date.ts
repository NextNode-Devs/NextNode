/**
 * The one way to show a date or time. An explicit locale and time zone keep
 * the server and the browser in agreement (no hydration mismatch). Phase 1
 * shows Toronto time, where the team and its demo run.
 */
export const DISPLAY_TIME_ZONE = "America/Toronto";
/** How the display time zone is named to people. */
export const DISPLAY_TIME_ZONE_LABEL = "Eastern Time (ET)";
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

const isoDay = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDay = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

/** Today's date in Toronto as `yyyy-mm-dd` (the `<input type="date">` format). Call in effects or
 * handlers, never during render. */
export function todayIso(now: Date = new Date()): string {
  return isoDay.format(now);
}

/** A calendar date (`yyyy-mm-dd`, no time) as "Feb 1, 2027". Read as UTC so it never shifts a day. */
export function formatCalendarDate(day: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : longDay.format(date);
}

const chipMonth = new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TIME_ZONE, month: "short" });
const chipDay = new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TIME_ZONE, day: "numeric" });
const weekdayAndTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const monthAndYear = new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TIME_ZONE, month: "long", year: "numeric" });
const monthKey = new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit" });

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The two halves of a date chip, in Toronto time: `{ month: "NOV", day: "21" }`. Empty for a bad value. */
export function dateChipParts(iso: string | null | undefined): { month: string; day: string } {
  const date = validDate(iso);
  if (!date) return { month: "", day: "" };
  return { month: chipMonth.format(date).replace(".", "").toUpperCase(), day: chipDay.format(date) };
}

/** "Fri, 2:00 p.m." in Toronto time. Empty for a bad value. */
export function formatWeekdayTime(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? weekdayAndTime.format(date) : "";
}

/** "November 2026" in Toronto time, for grouping by month. Empty for a bad value. */
export function formatMonthYear(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? monthAndYear.format(date) : "";
}

/** A sortable month key ("2026-11") in Toronto time, for grouping by month. Empty for a bad value. */
export function monthKeyOf(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? monthKey.format(date).slice(0, 7) : "";
}

/** The Toronto calendar day of a moment, as "Dec 11, 2026". Empty for a bad value. */
export function formatMomentDate(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? formatCalendarDate(isoDay.format(date)) : "";
}
