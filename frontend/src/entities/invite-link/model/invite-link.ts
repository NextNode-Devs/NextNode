/**
 * Time-limited team invitation links (Phase 2, NN-26 #90).
 *
 * PROTOTYPE: the API does not issue these yet. The planned shape is what
 * `GET /api/invite-links/{token}/` and the Team Lead's
 * `GET /api/projects/{id}/invite-links/` would return. The real token is
 * signed, single-use and carries its expiry; the server works out `status`
 * and checks it again when the link is accepted. The browser never decides
 * whether a link is valid.
 */
import { formatMessageTime } from "@/shared/lib/format-date";

export type InviteLinkStatus = "active" | "expired" | "used";

export type InviteLink = {
  token: string;
  project_id: number;
  /** Worked out by the server from the expiry and whether it has been used. */
  status: InviteLinkStatus;
  created_at: string;
  expires_at: string;
  /** Set once a developer has joined through it: a link works once. */
  used_at: string | null;
  used_by_name: string | null;
};

/** How long a new link lasts. The Team Lead picks one when creating it. */
export const INVITE_LINK_EXPIRY_OPTIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

export const DEFAULT_EXPIRY_HOURS = 72;

export const inviteLinkPath = (token: string) => `/invite/${encodeURIComponent(token)}`;

const HOUR = 60 * 60 * 1000;

/**
 * "in 2 days", "in 5 hours", "in under an hour", or "" once it has passed.
 * `now` is passed in (an ISO string from the server), so server and browser
 * render the same text.
 */
export function expiresIn(expiresAt: string, now: string): string {
  const left = new Date(expiresAt).getTime() - new Date(now).getTime();
  if (!Number.isFinite(left) || left <= 0) return "";
  const hours = Math.floor(left / HOUR);
  if (hours < 1) return "in under an hour";
  if (hours < 48) return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
  const days = Math.floor(hours / 24);
  return `in ${days} days`;
}

const when = (iso: string) => `${formatMessageTime(iso)} ET`;

/**
 * One line saying where a link stands, for the Team Lead:
 * "Expires in 2 days (Nov 25, 3:00 p.m. ET)", "Expired Nov 16, 3:00 p.m. ET",
 * "Used by Priya Raman on Nov 18, 3:00 p.m. ET".
 */
export function describeInviteLink(link: InviteLink, now: string): string {
  switch (link.status) {
    case "active": {
      const left = expiresIn(link.expires_at, now);
      return left ? `Expires ${left} (${when(link.expires_at)})` : `Expires ${when(link.expires_at)}`;
    }
    case "expired":
      return `Expired ${when(link.expires_at)}`;
    case "used":
      return link.used_at
        ? `Used by ${link.used_by_name ?? "a developer"} on ${when(link.used_at)}`
        : `Used by ${link.used_by_name ?? "a developer"}`;
  }
}

export const STATUS_TAG: Record<InviteLinkStatus, string> = {
  active: "Active",
  expired: "Expired",
  used: "Used",
};
