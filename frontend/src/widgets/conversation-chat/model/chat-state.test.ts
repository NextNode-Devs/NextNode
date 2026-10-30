import { describe, expect, it } from "vitest";

import type { Conversation, Message } from "@/entities/conversation";

import { chatReducer, INITIAL, latestId, mergeMessages, TIMED_OUT, type ChatState } from "./chat-state";

const conversation: Conversation = {
  id: "c1",
  subject_kind: "lead_application",
  subject_id: "a1",
  status: "open",
  close_reason: null,
  created_at: "2026-10-30T14:00:00Z",
  closed_at: null,
  participants: [
    { account_id: 1, display_name: "Grace" },
    { account_id: 2, display_name: "Ada" },
  ],
  last_message: null,
  unread_count: 0,
};

const msg = (id: number, author = 2): Message => ({
  id,
  conversation_id: "c1",
  author_id: author,
  body: `m${id}`,
  created_at: "2026-10-30T14:00:00Z",
});

const ready = (messages: Message[] = [msg(1), msg(2)]): ChatState =>
  chatReducer(INITIAL, { type: "loaded", conversation, messages, pageSize: 50 });

describe("mergeMessages", () => {
  it("keeps each id once, oldest first", () => {
    expect(mergeMessages([msg(3), msg(1)], [msg(2), msg(3)]).map((m) => m.id)).toEqual([1, 2, 3]);
  });
});

describe("chatReducer", () => {
  it("loads and knows whether older messages exist", () => {
    expect(ready().hasOlder).toBe(false);
    const full = chatReducer(INITIAL, {
      type: "loaded",
      conversation,
      messages: Array.from({ length: 50 }, (_, i) => msg(i + 1)),
      pageSize: 50,
    });
    expect(full.status).toBe("ready");
    expect(full.hasOlder).toBe(true);
  });

  it("tells not-found apart from other failures", () => {
    expect(chatReducer(INITIAL, { type: "load-failed", notFound: true, message: "x" }).status).toBe("not-found");
    expect(chatReducer(INITIAL, { type: "load-failed", notFound: false, message: "x" }).status).toBe("error");
  });

  it("shows a sent message as pending until the server echoes it back", () => {
    let state = chatReducer(ready(), { type: "send-started", clientId: "k1", body: "hello" });
    expect(state.pending).toEqual([{ clientId: "k1", body: "hello", state: "sending" }]);
    state = chatReducer(state, { type: "received", message: { ...msg(3, 1), body: "hello" }, clientId: "k1" });
    expect(state.pending).toEqual([]);
    expect(state.messages.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("does not duplicate a message received twice (live and catch-up)", () => {
    let state = chatReducer(ready(), { type: "received", message: msg(3), clientId: null });
    state = chatReducer(state, { type: "caught-up", messages: [msg(3), msg(4)] });
    expect(state.messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(latestId(state)).toBe(4);
  });

  it("marks a refused send as failed with the server's reason, and retry removes it", () => {
    let state = chatReducer(ready(), { type: "send-started", clientId: "k1", body: "hi" });
    state = chatReducer(state, { type: "send-failed", clientId: "k1", error: "Write a message first." });
    expect(state.pending[0]).toMatchObject({ state: "failed", error: "Write a message first." });
    state = chatReducer(state, { type: "retry", clientId: "k1" });
    expect(state.pending).toEqual([]);
  });

  it("times out only messages still sending", () => {
    let state = chatReducer(ready(), { type: "send-started", clientId: "k1", body: "hi" });
    state = chatReducer(state, { type: "send-timed-out", clientId: "k1" });
    expect(state.pending[0]).toMatchObject({ state: "failed", error: TIMED_OUT });
    const echoed = chatReducer(
      chatReducer(ready(), { type: "received", message: msg(3, 1), clientId: "k2" }),
      { type: "send-timed-out", clientId: "k2" },
    );
    expect(echoed.pending).toEqual([]);
  });

  it("a late echo still clears a message that had timed out", () => {
    let state = chatReducer(ready(), { type: "send-started", clientId: "k1", body: "hi" });
    state = chatReducer(state, { type: "send-timed-out", clientId: "k1" });
    state = chatReducer(state, { type: "received", message: msg(3, 1), clientId: "k1" });
    expect(state.pending).toEqual([]);
  });

  it("closing keeps the history, records the reason and fails anything in flight", () => {
    let state = chatReducer(ready(), { type: "send-started", clientId: "k1", body: "hi" });
    state = chatReducer(state, { type: "closed", reason: "Another Team Lead was hired.", closedAt: "x" });
    expect(state.conversation).toMatchObject({ status: "closed", close_reason: "Another Team Lead was hired." });
    expect(state.messages).toHaveLength(2);
    expect(state.pending[0]).toMatchObject({ state: "failed" });
  });

  it("prepends older messages and keeps paging until a short page", () => {
    let state = chatReducer(ready([msg(51), msg(52)]), { type: "older-started" });
    expect(state.loadingOlder).toBe(true);
    state = chatReducer(state, { type: "older-loaded", messages: [msg(49), msg(50)], pageSize: 50 });
    expect(state.messages.map((m) => m.id)).toEqual([49, 50, 51, 52]);
    expect(state.hasOlder).toBe(false);
    expect(state.loadingOlder).toBe(false);
  });
});
