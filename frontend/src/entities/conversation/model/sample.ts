/**
 * PROTOTYPE SAMPLE DATA (Phase 2, NN-32 #88). Only prototype screens may
 * import this; never a Phase 1 screen.
 *
 * The dashboard v2 inbox for each kind of account. Fixed dates keep server
 * and browser renders identical. Clients have no team chats: the team chat is
 * the team's own conversation, which the client is not part of (#6).
 */
import type { InboxItem } from "./inbox";

const DEVELOPER: InboxItem[] = [
  {
    id: "t1",
    tab: "team",
    title: "Clinic booking app team",
    subtitle: "Team chat",
    preview: "Margaret: Sign-up and password reset are merged.",
    unread_count: 4,
    updated_at: "2026-11-23T15:20:00Z",
  },
  {
    id: "t2",
    tab: "team",
    title: "Food bank tracker team",
    subtitle: "Team chat",
    preview: "Lee: Stand-up moved to 11:00 tomorrow.",
    unread_count: 2,
    updated_at: "2026-11-22T19:05:00Z",
  },
  {
    id: "t3",
    tab: "team",
    title: "Campus marketplace team",
    subtitle: "Team chat",
    preview: "You: I'll pick up the search page.",
    unread_count: 0,
    updated_at: "2026-11-20T14:00:00Z",
  },
  {
    id: "m1",
    tab: "messages",
    title: "Grace",
    subtitle: "Invitation to lead · Pet adoption portal",
    preview: "Would you like to lead this? The brief is attached.",
    unread_count: 1,
    updated_at: "2026-11-23T13:40:00Z",
  },
  {
    id: "m2",
    tab: "messages",
    title: "Hana Kim",
    subtitle: "Direct message",
    preview: "Thanks for the code review!",
    unread_count: 0,
    updated_at: "2026-11-19T22:10:00Z",
  },
  {
    id: "p1",
    tab: "applications",
    title: "Linus",
    subtitle: "Joining a team · Clinic booking app",
    preview: "I've built two booking flows with Django before.",
    unread_count: 2,
    updated_at: "2026-11-23T11:15:00Z",
  },
  {
    id: "p2",
    tab: "applications",
    title: "Bakery ordering site",
    subtitle: "Your application to lead",
    preview: "Client: Thanks, I'll decide by Friday.",
    unread_count: 0,
    updated_at: "2026-11-21T16:30:00Z",
  },
];

const CLIENT: InboxItem[] = [
  {
    id: "m1",
    tab: "messages",
    title: "Ada",
    subtitle: "Team Lead · Clinic booking app",
    preview: "Milestone 2 is on staging for your review.",
    unread_count: 1,
    updated_at: "2026-11-23T14:00:00Z",
  },
  {
    id: "m2",
    tab: "messages",
    title: "Sam Ortiz",
    subtitle: "Team Lead · Inventory dashboard",
    preview: "I've sent a revised offer with three milestones.",
    unread_count: 2,
    updated_at: "2026-11-22T20:45:00Z",
  },
  {
    id: "p1",
    tab: "applications",
    title: "Noah Fischer",
    subtitle: "Application to lead · Bakery ordering site",
    preview: "I've shipped two ordering sites with Stripe.",
    unread_count: 3,
    updated_at: "2026-11-23T10:05:00Z",
  },
  {
    id: "p2",
    tab: "applications",
    title: "Hana Kim",
    subtitle: "Application to lead · Bakery ordering site",
    preview: "Happy to share my portfolio projects.",
    unread_count: 0,
    updated_at: "2026-11-21T09:30:00Z",
  },
];

export function sampleInbox(accountRole: "developer" | "client"): InboxItem[] {
  return accountRole === "client" ? CLIENT : DEVELOPER;
}
