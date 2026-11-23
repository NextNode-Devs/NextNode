/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-26 #90). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * Every team gets one active link and two earlier ones (one expired, one
 * used), dated from `now` so they never go stale. Sample tokens are readable
 * (`nn-<projectId>-<status>`) so each screen can be opened; real tokens are
 * signed and opaque.
 */
import type { InviteLink, InviteLinkStatus } from "./invite-link";

const HOUR = 60 * 60 * 1000;
const STATUSES: readonly InviteLinkStatus[] = ["active", "expired", "used"];

const at = (now: string, hours: number) => new Date(new Date(now).getTime() + hours * HOUR).toISOString();

export const sampleInviteToken = (projectId: number, status: InviteLinkStatus) => `nn-${projectId}-${status}`;

function sampleLink(projectId: number, status: InviteLinkStatus, now: string): InviteLink {
  const base = { token: sampleInviteToken(projectId, status), project_id: projectId, status };
  switch (status) {
    case "active":
      // A 3-day link made yesterday: about 2 days left.
      return { ...base, created_at: at(now, -24), expires_at: at(now, 48), used_at: null, used_by_name: null };
    case "expired":
      return { ...base, created_at: at(now, -10 * 24), expires_at: at(now, -7 * 24), used_at: null, used_by_name: null };
    case "used":
      return {
        ...base,
        created_at: at(now, -6 * 24),
        expires_at: at(now, -3 * 24),
        used_at: at(now, -5 * 24),
        used_by_name: "Priya Raman (sample)",
      };
  }
}

/** The Team Lead's links for one team: the active one, then earlier ones, newest first. */
export function sampleInviteLinks(projectId: number, now: string): { active: InviteLink; earlier: InviteLink[] } {
  return {
    active: sampleLink(projectId, "active", now),
    earlier: [sampleLink(projectId, "used", now), sampleLink(projectId, "expired", now)],
  };
}

/** What the planned `GET /api/invite-links/{token}/` returns, or `null` for a token it doesn't know. */
export function sampleInviteLinkByToken(token: string, now: string): InviteLink | null {
  const match = /^nn-(\d{1,9})-(active|expired|used)$/.exec(token);
  if (!match) return null;
  const status = STATUSES.find((s) => s === match[2]);
  return status ? sampleLink(Number(match[1]), status, now) : null;
}
