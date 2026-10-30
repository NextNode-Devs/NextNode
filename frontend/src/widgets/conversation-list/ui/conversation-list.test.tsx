import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Conversation } from "@/entities/conversation";

import type { ListState } from "../model/list-state";
import { ConversationList } from "./conversation-list";

const state = vi.hoisted(() => ({ current: { status: "loading" } as ListState }));
vi.mock("../model/use-conversation-list", () => ({ useConversationList: () => state.current }));

const conv = (id: string, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  subject_kind: "lead_application",
  subject_id: id,
  status: "open",
  close_reason: null,
  created_at: "2026-10-30T14:00:00Z",
  closed_at: null,
  participants: [
    { account_id: 1, display_name: "Grace" },
    { account_id: 2, display_name: "Ada" },
  ],
  last_message: { id: 5, conversation_id: id, author_id: 2, body: "Can I lead this?", created_at: "2026-10-30T14:42:00Z" },
  unread_count: 2,
  ...overrides,
});

describe("ConversationList", () => {
  it("shows a loading state", () => {
    state.current = { status: "loading" };
    render(<ConversationList myAccountId={1} />);
    expect(screen.getByRole("status", { name: "Loading conversations" })).toBeInTheDocument();
  });

  it("explains how conversations start when there are none", () => {
    state.current = { status: "ready", conversations: [] };
    render(<ConversationList myAccountId={1} />);
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });

  it("shows the API's sentence when loading fails", () => {
    state.current = { status: "error", message: "The API could not be reached." };
    render(<ConversationList myAccountId={1} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The API could not be reached.");
  });

  it("lists the other person, the subject, a preview and the unread count, linking to the chat", () => {
    state.current = { status: "ready", conversations: [conv("c1")] };
    render(<ConversationList myAccountId={1} />);
    const link = screen.getByRole("link", { name: /ada/i });
    expect(link).toHaveAttribute("href", "/conversations/c1");
    expect(link).toHaveTextContent("Application to lead");
    expect(link).toHaveTextContent("Can I lead this?");
    expect(screen.getByLabelText("2 unread")).toBeInTheDocument();
  });

  it("marks the open conversation as current and hides its unread count", () => {
    state.current = { status: "ready", conversations: [conv("c1")] };
    render(<ConversationList myAccountId={1} activeId="c1" />);
    expect(screen.getByRole("link", { name: /ada/i })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByLabelText("2 unread")).not.toBeInTheDocument();
  });

  it("prefixes my own last message and marks closed conversations", () => {
    state.current = {
      status: "ready",
      conversations: [
        conv("c1", {
          status: "closed",
          unread_count: 0,
          last_message: { id: 6, conversation_id: "c1", author_id: 1, body: "Thanks!", created_at: null },
        }),
      ],
    };
    render(<ConversationList myAccountId={1} />);
    expect(screen.getByRole("link", { name: /ada/i })).toHaveTextContent("You: Thanks!");
    expect(screen.getByLabelText("Closed")).toBeInTheDocument();
  });

  it("shows only the latest few when limited", () => {
    state.current = { status: "ready", conversations: [conv("a"), conv("b"), conv("c"), conv("d")] };
    render(<ConversationList myAccountId={1} limit={3} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
