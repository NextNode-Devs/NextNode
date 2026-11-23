import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_NOTIFICATIONS } from "@/entities/notification";

import type { NotificationLoader } from "../model/use-notifications";
import { NotificationBell } from "./notification-bell";

const toast = vi.fn();
const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({
  toast: (input: unknown) => toast(input),
  underConstruction: (feature: string) => underConstruction(feature),
}));

const ok = (items = [...SAMPLE_NOTIFICATIONS]): NotificationLoader => async () => ({ ok: true, data: items });
const bell = (name: string | RegExp = /^Notifications/) => screen.getByRole("button", { name });

describe("NotificationBell", () => {
  beforeEach(() => {
    toast.mockClear();
    underConstruction.mockClear();
  });

  it("names the bell with its unread count once loaded", async () => {
    render(<NotificationBell load={ok()} />);
    expect(await screen.findByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument();
  });

  it("opens with the keyboard, is marked as a prototype, and lists the newest first", async () => {
    const user = userEvent.setup();
    render(<NotificationBell load={ok()} />);
    await screen.findByRole("button", { name: "Notifications, 3 unread" });
    await user.tab();
    expect(bell()).toHaveFocus();
    await user.keyboard("{Enter}");
    const dropdown = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(dropdown).getByText("Prototype")).toBeInTheDocument();
    const items = within(dropdown).getAllByRole("listitem");
    expect(items).toHaveLength(SAMPLE_NOTIFICATIONS.length);
    expect(items[0]).toHaveTextContent("Unread: New application to join your team");
    expect(within(dropdown).getByRole("link", { name: "Notification settings" })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
  });

  it("closes on Esc and returns focus to the bell", async () => {
    const user = userEvent.setup();
    render(<NotificationBell load={ok()} />);
    await user.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(bell()).toHaveFocus();
  });

  it("shows a new notification as a toast, adds it to the list and announces the count", async () => {
    const user = userEvent.setup();
    render(<NotificationBell load={ok()} />);
    await user.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    await user.click(screen.getByRole("button", { name: "Show a sample new notification" }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Hana Kim accepted your invitation", tone: "info" }));
    expect(within(screen.getByRole("dialog")).getAllByRole("listitem")[0]).toHaveTextContent("Hana Kim accepted");
    expect(bell("Notifications, 4 unread")).toBeInTheDocument();
    expect(screen.getByText("New notification. 4 unread.")).toBeInTheDocument();
  });

  it("uses the under-construction toast for actions that aren't built", async () => {
    const user = userEvent.setup();
    render(<NotificationBell load={ok()} />);
    await user.click(await screen.findByRole("button", { name: "Notifications, 3 unread" }));
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(underConstruction).toHaveBeenCalledWith("Mark all as read");
    await user.click(screen.getByRole("button", { name: /New application to join your team/ }));
    expect(underConstruction).toHaveBeenCalledWith("Open notification");
  });

  it("shows loading while the list loads, with no count yet", async () => {
    const user = userEvent.setup();
    render(<NotificationBell load={() => new Promise(() => {})} />);
    await user.click(bell("Notifications"));
    expect(screen.getByRole("status", { name: "Loading notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show a sample new notification" })).not.toBeInTheDocument();
  });

  it("says when the list can't load, and tries again", async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<NotificationLoader>()
      .mockResolvedValueOnce({ ok: false, error: { code: "UNAVAILABLE", message: "The server is down." } })
      .mockResolvedValueOnce({ ok: true, data: [] });
    render(<NotificationBell load={load} />);
    await user.click(bell("Notifications"));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your notifications. The server is down.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument();
    expect(bell("Notifications, none unread")).toBeInTheDocument();
  });
});
