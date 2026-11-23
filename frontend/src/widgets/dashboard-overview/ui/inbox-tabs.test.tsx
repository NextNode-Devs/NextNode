import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { sampleInbox } from "@/entities/conversation";

import { InboxTabs } from "./inbox-tabs";

const underConstruction = vi.fn();
vi.mock("@/shared/lib/toast", () => ({ underConstruction: (feature: string) => underConstruction(feature) }));

describe("InboxTabs", () => {
  it("names each tab with its unread count", () => {
    render(<InboxTabs items={sampleInbox("developer")} accountRole="developer" />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Team chats6, 6 unread",
      "Direct and hiring1, 1 unread",
      "Applications2, 2 unread",
    ]);
  });

  it("moves between tabs with the arrow keys and shows that tab's conversations", async () => {
    const user = userEvent.setup();
    render(<InboxTabs items={sampleInbox("developer")} accountRole="developer" />);
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(3);
    await user.click(screen.getByRole("tab", { name: /Team chats/ }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Direct and hiring/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Invitation to lead · Pet adoption portal");
    await user.click(within(screen.getByRole("tabpanel")).getAllByRole("button")[0]);
    expect(underConstruction).toHaveBeenCalledWith("Open sample conversation");
  });

  it("tells a client that team chats are private to the team", () => {
    render(<InboxTabs items={sampleInbox("client")} accountRole="client" />);
    expect(screen.getByRole("tab", { name: /Team chats/ })).toHaveTextContent("No unread messages");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Team chats are private to each team");
  });

  it("shows an empty tab plainly", async () => {
    const user = userEvent.setup();
    render(<InboxTabs items={[]} accountRole="developer" />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("No team chats yet.");
    await user.click(screen.getByRole("tab", { name: /Applications/ }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("No applications yet.");
  });
});
