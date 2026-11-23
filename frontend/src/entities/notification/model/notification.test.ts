import { describe, expect, it } from "vitest";

import { bellLabel, CATEGORY_LABEL, DEFAULT_NOTIFICATION_SETTINGS, NOTIFICATION_CATEGORIES, unreadCount } from "./notification";
import { SAMPLE_NOTIFICATIONS, sampleIncomingNotification } from "./sample";

describe("notifications", () => {
  it("counts unread ones", () => {
    expect(unreadCount(SAMPLE_NOTIFICATIONS)).toBe(3);
    expect(unreadCount([])).toBe(0);
  });

  it("names the bell with its count, said plainly", () => {
    expect(bellLabel(null)).toBe("Notifications");
    expect(bellLabel(0)).toBe("Notifications, none unread");
    expect(bellLabel(3)).toBe("Notifications, 3 unread");
  });

  it("has a setting for every category, and a label for each", () => {
    for (const { id } of NOTIFICATION_CATEGORIES) {
      expect(DEFAULT_NOTIFICATION_SETTINGS[id]).toBeDefined();
      expect(CATEGORY_LABEL[id]).toBeTruthy();
    }
  });

  it("makes new sample notifications unread, in turn, with new ids", () => {
    const now = "2026-11-23T18:00:00.000Z";
    const first = sampleIncomingNotification(0, now);
    const second = sampleIncomingNotification(1, now);
    expect(first).toMatchObject({ read: false, created_at: now });
    expect(second.id).not.toBe(first.id);
    expect(second.title).not.toBe(first.title);
    expect(SAMPLE_NOTIFICATIONS.map((n) => n.id)).not.toContain(first.id);
  });
});
