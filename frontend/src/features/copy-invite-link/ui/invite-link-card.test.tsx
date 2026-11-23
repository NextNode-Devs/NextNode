import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleInviteLinks } from "@/entities/invite-link";

import { InviteLinkCard } from "./invite-link-card";

const toast = vi.fn();
const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({
  toast: (input: unknown) => toast(input),
  underConstruction: (feature: string) => underConstruction(feature),
}));

const NOW = "2026-11-23T17:00:00.000Z";
const links = sampleInviteLinks(4, NOW);

const setClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

describe("InviteLinkCard", () => {
  beforeEach(() => {
    toast.mockClear();
    underConstruction.mockClear();
  });

  it("shows the current link, its expiry, and marks the section as a prototype", () => {
    render(<InviteLinkCard links={links} now={NOW} />);
    const field = screen.getByRole("textbox", { name: "Current link" });
    expect(field).toHaveValue(`${window.location.origin}/invite/nn-4-active`);
    expect(field).toHaveAccessibleDescription("Expires in 2 days (Nov 25, 12:00 p.m. ET)");
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("copies the full link and confirms with a toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    render(<InviteLinkCard links={links} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/nn-4-active`);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invite link copied", tone: "success" }));
  });

  it("says so and selects the link when the browser won't copy it", async () => {
    const user = userEvent.setup();
    setClipboard(async () => {
      throw new Error("denied");
    });
    render(<InviteLinkCard links={links} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't copy the link", tone: "error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Copying didn't work here");
    const field = screen.getByRole("textbox", { name: "Current link" }) as HTMLInputElement;
    expect(field.selectionEnd! - field.selectionStart!).toBe(field.value.length);
  });

  it("lists earlier links with their status and a preview of the screen the developer sees", () => {
    render(<InviteLinkCard links={links} now={NOW} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Used by Priya Raman (sample)"),
      expect.stringContaining("Expired Nov 16"),
    ]);
    const previews = screen.getAllByRole("link", { name: /See what a developer sees/ });
    expect(previews.map((link) => link.getAttribute("href"))).toEqual(["/invite/nn-4-used", "/invite/nn-4-expired"]);
  });

  it("offers to create a link when there is none, choosing its expiry in a dialog", async () => {
    const user = userEvent.setup();
    render(<InviteLinkCard links={{ active: null, earlier: [] }} now={NOW} />);
    expect(screen.getByText("No active invite link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy invite link" })).not.toBeInTheDocument();

    const opener = screen.getByRole("button", { name: "Create invite link" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Create an invite link" });
    expect(within(dialog).getByRole("radio", { name: "3 days" })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: "7 days" }));
    await user.click(within(dialog).getByRole("button", { name: "Create link" }));
    expect(underConstruction).toHaveBeenCalledWith("Create invite link");
  });

  it("closes the dialog with Esc and returns focus to the button that opened it", async () => {
    const user = userEvent.setup();
    render(<InviteLinkCard links={links} now={NOW} />);
    const opener = screen.getByRole("button", { name: "Create new link" });
    await user.click(opener);
    expect(screen.getByText("Creating a new link stops the current one working.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("uses the under-construction toast to revoke", async () => {
    const user = userEvent.setup();
    render(<InviteLinkCard links={links} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(underConstruction).toHaveBeenCalledWith("Revoke invite link");
  });
});
