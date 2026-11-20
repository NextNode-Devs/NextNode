/**
 * PROTOTYPE SAMPLE DATA (Phase 2, #92). Only prototype screens may import
 * this; never a Phase 1 screen. Replace with the API once VideoLink exists.
 * Fixed dates and ids keep server and browser renders identical.
 */
import type { VideoLink } from "./video-link";

const ADA = { account_id: 1, display_name: "Ada" };
const LINUS = { account_id: 2, display_name: "Linus" };

export const SAMPLE_VIDEO_LINKS: VideoLink[] = [
  {
    id: 1,
    project_id: 9001,
    title: "Weekly stand-up",
    url: "https://meet.google.com/abc-defg-hij",
    schedule: { kind: "weekly", days: ["mon", "thu"], time: "10:00" },
    added_by: ADA,
    created_at: "2026-11-02T15:00:00Z",
  },
  {
    id: 2,
    project_id: 9001,
    title: "Account pages demo",
    url: "https://us02web.zoom.us/j/1234567890",
    schedule: { kind: "once", starts_at: "2026-12-11T19:00:00Z" },
    added_by: ADA,
    created_at: "2026-11-20T15:00:00Z",
  },
  {
    id: 3,
    project_id: 9001,
    title: "Milestone 2 review",
    url: "https://meet.google.com/klm-nopq-rst",
    schedule: { kind: "once", starts_at: "2026-12-18T16:00:00Z" },
    added_by: ADA,
    created_at: "2026-11-20T15:05:00Z",
  },
  {
    id: 4,
    project_id: 9001,
    title: "Milestone 1 review",
    url: "https://meet.google.com/uvw-xyza-bcd",
    schedule: { kind: "once", starts_at: "2026-11-16T16:00:00Z" },
    added_by: ADA,
    created_at: "2026-11-10T15:00:00Z",
  },
  {
    id: 5,
    project_id: 9001,
    title: "Kick-off with the client",
    url: "https://us02web.zoom.us/j/9876543210",
    schedule: { kind: "once", starts_at: "2026-11-10T20:00:00Z" },
    added_by: ADA,
    created_at: "2026-11-05T15:00:00Z",
  },
  {
    id: 6,
    project_id: 9001,
    title: "Team intro call",
    url: "https://teams.microsoft.com/l/meetup-join/sample",
    schedule: { kind: "once", starts_at: "2026-10-31T22:00:00Z" },
    added_by: LINUS,
    created_at: "2026-10-30T15:00:00Z",
  },
];
