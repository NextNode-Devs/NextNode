/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-19 #89). Only prototype screens and the
 * header's prototype bell may import this.
 *
 * Fixed dates and ids keep server and browser renders identical. Payment
 * notifications mention receipts only: the running integration holds no funds.
 */
import type { AppNotification } from "./notification";

export const SAMPLE_NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: 6,
    category: "hiring",
    title: "New application to join your team",
    body: "Linus applied to join Clinic booking app.",
    created_at: "2026-11-23T15:10:00Z",
    read: false,
  },
  {
    id: 5,
    category: "projects",
    title: "Milestone 2 submitted for review",
    body: "Ada submitted milestone 2 of Clinic booking app.",
    created_at: "2026-11-23T13:45:00Z",
    read: false,
  },
  {
    id: 4,
    category: "messages",
    title: "New message from Grace",
    body: "Would you like to lead Pet adoption portal?",
    created_at: "2026-11-22T21:30:00Z",
    read: false,
  },
  {
    id: 3,
    category: "team",
    title: "Margaret joined your team",
    body: "Food bank tracker now has 4 of 5 people.",
    created_at: "2026-11-21T17:05:00Z",
    read: true,
  },
  {
    id: 2,
    category: "payments",
    title: "Your deposit receipt is ready",
    body: "Receipt for the Clinic booking app deposit.",
    created_at: "2026-11-19T14:20:00Z",
    read: true,
  },
];

const INCOMING: readonly Omit<AppNotification, "id" | "created_at" | "read">[] = [
  { category: "team", title: "Hana Kim accepted your invitation", body: "Hana Kim joined Campus marketplace." },
  { category: "projects", title: "The client approved milestone 1", body: "Food bank tracker moves to milestone 2." },
  { category: "messages", title: "New message from Sam Ortiz", body: "I've sent a revised offer." },
];

/**
 * A sample "new" notification, as the WebSocket would push it. `n` picks one
 * in turn; `now` (an ISO string) is read in the click handler, never in render.
 */
export function sampleIncomingNotification(n: number, now: string): AppNotification {
  return { ...INCOMING[n % INCOMING.length], id: 100 + n, created_at: now, read: false };
}
