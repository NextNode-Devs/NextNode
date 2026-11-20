import { VIDEO_LINK_LIMITS, type Weekday } from "@/entities/video-link";

export type VideoLinkDraft = {
  title: string;
  url: string;
  kind: "once" | "weekly";
  date: string; // yyyy-mm-dd, one meeting only
  time: string; // HH:MM
  days: Weekday[]; // recurring only
};

export const EMPTY_VIDEO_LINK: VideoLinkDraft = { title: "", url: "", kind: "once", date: "", time: "", days: [] };

export type VideoLinkErrors = Partial<Record<"title" | "url" | "date" | "time" | "days", string>>;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Mirrors the planned API's checks, so mistakes show on the field at once. */
export function checkVideoLink(draft: VideoLinkDraft): VideoLinkErrors {
  const errors: VideoLinkErrors = {};
  const title = draft.title.trim();
  const url = draft.url.trim();
  if (!title) errors.title = "Give the meeting a name.";
  else if (title.length > VIDEO_LINK_LIMITS.titleMax) errors.title = `Keep the name under ${VIDEO_LINK_LIMITS.titleMax} characters.`;
  if (!url) errors.url = "Paste the meeting link.";
  else if (url.length > VIDEO_LINK_LIMITS.urlMax || !isHttpsUrl(url)) errors.url = "Use a full meeting link starting with https://.";
  if (draft.kind === "once" && !draft.date) errors.date = "Pick the meeting's date.";
  if (draft.kind === "weekly" && draft.days.length === 0) errors.days = "Pick at least one day.";
  if (!draft.time) errors.time = "Pick a time.";
  return errors;
}
