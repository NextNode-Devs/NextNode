import { describe, expect, it } from "vitest";

import { parseClosed, parseMessageNew, parseOpened, parseSendError, sendFrame } from "./frames";

describe("conversation frames", () => {
  it("reads message.new and keeps the client id", () => {
    const parsed = parseMessageNew({
      type: "message.new",
      conversation_id: "c1",
      client_id: "k1",
      message: { id: 3, conversation_id: "c1", author_id: 2, body: "hi", created_at: null },
    });
    expect(parsed).toMatchObject({ conversationId: "c1", clientId: "k1", message: { id: 3, body: "hi" } });
  });

  it.each([
    { type: "message.new" },
    { type: "message.new", conversation_id: "c1" },
    { type: "message.new", conversation_id: "c1", message: { id: "3", body: "x" } },
  ])("ignores a malformed message.new %#", (frame) => {
    expect(parseMessageNew(frame)).toBeNull();
  });

  it("reads conversation.closed and conversation.opened", () => {
    expect(parseClosed({ type: "conversation.closed", conversation_id: "c1", reason: "Full." })).toEqual({
      conversationId: "c1",
      reason: "Full.",
      closedAt: null,
    });
    expect(parseOpened({ type: "conversation.opened", conversation: { id: "c1", participants: [] } })).toMatchObject({
      id: "c1",
    });
    expect(parseOpened({ type: "conversation.opened" })).toBeNull();
  });

  it("only treats errors with a client id as answers to our sends", () => {
    expect(parseSendError({ type: "error", code: "BAD_FRAME", message: "x" })).toBeNull();
    expect(parseSendError({ type: "error", client_id: "k1", code: "CONVERSATION_CLOSED", message: "Closed." })).toEqual({
      clientId: "k1",
      code: "CONVERSATION_CLOSED",
      message: "Closed.",
    });
  });

  it("builds the send frame the backend expects", () => {
    expect(sendFrame("c1", "k1", "hello")).toEqual({
      type: "message.send",
      conversation_id: "c1",
      client_id: "k1",
      body: "hello",
    });
  });
});
