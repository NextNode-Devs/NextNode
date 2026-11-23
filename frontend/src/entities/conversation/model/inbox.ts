/**
 * The dashboard v2 inbox (Phase 2, NN-32 #88): every conversation the viewer
 * is in, sorted into three tabs, each with an unread count.
 *
 * PROTOTYPE: planned read model (part of `GET /api/dashboard/`). Phase 1's
 * `GET /api/conversations/` already has `unread_count` per conversation; the
 * server adds which tab each belongs to. Direct messages are planned only.
 */

export type InboxTab = "team" | "messages" | "applications";

export const INBOX_TABS: readonly InboxTab[] = ["team", "messages", "applications"];

export const INBOX_TAB_LABEL: Record<InboxTab, string> = {
  team: "Team chats",
  messages: "Direct and hiring",
  applications: "Applications",
};

export type InboxItem = {
  id: string;
  tab: InboxTab;
  /** Who or what it's with: "Clinic booking app team", "Grace". */
  title: string;
  /** What it's about: "Invitation to lead · Pet adoption portal". */
  subtitle: string;
  preview: string;
  unread_count: number;
  updated_at: string;
};

/** Unread messages per tab. */
export function unreadByTab(items: readonly InboxItem[]): Record<InboxTab, number> {
  const counts: Record<InboxTab, number> = { team: 0, messages: 0, applications: 0 };
  for (const item of items) counts[item.tab] += item.unread_count;
  return counts;
}

/** "3 unread", "No unread messages": what a tab's count means, said for screen readers too. */
export const unreadText = (count: number) => (count === 0 ? "No unread messages" : `${count} unread`);
