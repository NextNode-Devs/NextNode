import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationSettingsForm } from "./notification-settings-form";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (feature: string) => underConstruction(feature) }));

const setPermission = (permission: NotificationPermission | undefined) => {
  if (permission === undefined) vi.stubGlobal("Notification", undefined);
  else vi.stubGlobal("Notification", { permission });
};

describe("NotificationSettingsForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    underConstruction.mockClear();
  });

  it("has an in-app and an email switch for every kind, starting from the defaults", () => {
    setPermission("default");
    render(<NotificationSettingsForm />);
    expect(screen.getByRole("switch", { name: "Hiring: In the app" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Hiring: Email" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Messages: Email" })).not.toBeChecked();
    expect(screen.getAllByRole("switch")).toHaveLength(10);
  });

  it("changes a switch with the keyboard, resets, and saving is under construction", async () => {
    const user = userEvent.setup();
    setPermission("default");
    render(<NotificationSettingsForm />);
    const email = screen.getByRole("switch", { name: "Messages: Email" });
    email.focus();
    await user.keyboard(" ");
    expect(email).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(email).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(underConstruction).toHaveBeenCalledWith("Save notification settings");
  });

  it("says plainly when the browser has blocked notifications", () => {
    setPermission("denied");
    render(<NotificationSettingsForm />);
    expect(screen.getByText("This browser has blocked notifications from NextNode.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on browser alerts" })).not.toBeInTheDocument();
  });

  it("offers browser alerts when not decided yet (under construction), and confirms when allowed", async () => {
    const user = userEvent.setup();
    setPermission("default");
    const { unmount } = render(<NotificationSettingsForm />);
    await user.click(screen.getByRole("button", { name: "Turn on browser alerts" }));
    expect(underConstruction).toHaveBeenCalledWith("Turn on browser alerts");
    unmount();
    setPermission("granted");
    render(<NotificationSettingsForm />);
    expect(screen.getByText("This browser allows alerts from NextNode.")).toBeInTheDocument();
  });

  it("explains a browser that can't show alerts", () => {
    setPermission(undefined);
    render(<NotificationSettingsForm />);
    expect(screen.getByText(/This browser can't show alerts/)).toBeInTheDocument();
  });
});
