import { describe, expect, it } from "vitest";

import type { Conversation } from "@/entities/conversation";

import { listReducer, type ListState } from "./list-state";

const conv = (id: string, at: string, unread = 0): Conversation => ({
  id,
  subject_kind: "lead_application",
  subject_id: id,
  status: "open",
  close_reason: null,
  created_at: at,
  closed_at: null,
  participants: [
    { account_id: 1, display_name: "Grace" },
    { account_id: 2, display_name: "Ada" },
  ],
  last_message: null,
  unread_count: unread,
});

const loaded = (): ListState =>
  listReducer(
    { status: "loading" },
    { type: "loaded", conversations: [conv("old", "2026-10-29T10:00:00Z"), conv("new", "2026-10-30T10:00:00Z")] },
  );

const ids = (state: ListState) => (state.status === "ready" ? state.conversations.map((c) => c.id) : []);
const find = (state: ListState, id: string) =>
  state.status === "ready" ? state.conversations.find((c) => c.id === id) : undefined;

const message = (conversationId: string, author: number) => ({
  conversationId,
  clientId: null,
  message: { id: 9, conversation_id: conversationId, author_id: author, body: "hi", created_at: "2026-10-30T12:00:00Z" },
});

describe("listReducer", () => {
  it("orders by latest activity", () => {
    expect(ids(loaded())).toEqual(["new", "old"]);
  });

  it("a new message from the other person moves it up and counts as unread", () => {
    const state = listReducer(loaded(), { type: "message", frame: message("old", 2), myAccountId: 1, activeId: null });
    expect(ids(state)).toEqual(["old", "new"]);
    expect(find(state, "old")).toMatchObject({ unread_count: 1, last_message: { body: "hi" } });
  });

  it("my own messages and the open conversation are never unread", () => {
    const mine = listReducer(loaded(), { type: "message", frame: message("old", 1), myAccountId: 1, activeId: null });
    expect(find(mine, "old")?.unread_count).toBe(0);
    const open = listReducer(loaded(), { type: "message", frame: message("old", 2), myAccountId: 1, activeId: "old" });
    expect(find(open, "old")?.unread_count).toBe(0);
  });

  it("adds a newly opened conversation once", () => {
    let state = listReducer(loaded(), { type: "opened", conversation: conv("fresh", "2026-10-31T00:00:00Z") });
    state = listReducer(state, { type: "opened", conversation: conv("fresh", "2026-10-31T00:00:00Z") });
    expect(ids(state)).toEqual(["fresh", "new", "old"]);
  });

  it("marks a conversation closed with its reason", () => {
    const state = listReducer(loaded(), {
      type: "closed",
      frame: { conversationId: "new", reason: "The team is full.", closedAt: "2026-10-30T13:00:00Z" },
    });
    expect(find(state, "new")).toMatchObject({ status: "closed", close_reason: "The team is full." });
  });

  it("opening one clears its unread count", () => {
    const state = listReducer(
      listReducer({ status: "loading" }, { type: "loaded", conversations: [conv("a", "2026-10-30T10:00:00Z", 3)] }),
      { type: "read", conversationId: "a" },
    );
    expect(find(state, "a")?.unread_count).toBe(0);
  });

  it("ignores live frames until the list has loaded", () => {
    const state = listReducer({ status: "loading" }, { type: "read", conversationId: "a" });
    expect(state).toEqual({ status: "loading" });
  });
});
