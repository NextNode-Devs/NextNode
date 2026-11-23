/**
 * Notifications (Phase 2, NN-19 #89; stakeholder Q2, Q3).
 *
 * PROTOTYPE: planned shapes for `GET /api/notifications/` and
 * `GET/PUT /api/notifications/settings/`. The real version is a Notification
 * row pushed over the existing WebSocket, plus email through the provider,
 * filtered by the viewer's settings on the server.
 */

/** The settings page (shared with Jay, #102; further settings join `/settings/*`). */
export const NOTIFICATION_SETTINGS_PATH = "/settings/notifications";

/** What a notification is about; each category can be turned on or off. */
export type NotificationCategory = "hiring" | "team" | "projects" | "payments" | "messages";

export const NOTIFICATION_CATEGORIES: readonly {
  id: NotificationCategory;
  label: string;
  description: string;
}[] = [
  { id: "hiring", label: "Hiring", description: "Applications, invitations and offers." },
  { id: "team", label: "Team", description: "Someone joins or leaves, or a new Team Lead is proposed." },
  { id: "projects", label: "Projects", description: "Milestones submitted, approved or sent back, and project updates." },
  { id: "payments", label: "Payments", description: "Deposits, receipts and refund requests." },
  { id: "messages", label: "Messages", description: "New messages in your conversations." },
];

export type AppNotification = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};

export type Channel = "in_app" | "email";

export type NotificationSettings = Record<NotificationCategory, Record<Channel, boolean>>;

/** Everything in the app; email for what needs action soon. */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  hiring: { in_app: true, email: true },
  team: { in_app: true, email: true },
  projects: { in_app: true, email: true },
  payments: { in_app: true, email: true },
  messages: { in_app: true, email: false },
};

export const CATEGORY_LABEL = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<NotificationCategory, string>;

export const unreadCount = (items: readonly AppNotification[]) => items.filter((item) => !item.read).length;

/** The bell's name, count included: "Notifications, 3 unread". */
export function bellLabel(unread: number | null): string {
  if (unread === null) return "Notifications";
  return unread === 0 ? "Notifications, none unread" : `Notifications, ${unread} unread`;
}
