/**
 * Socket frames for hiring conversations (backend
 * `presentation/realtime/conversations.py`). Parsed defensively: a frame that
 * doesn't have the expected shape is ignored, never trusted.
 */
import type { Frame } from "@/shared/api/realtime";

import type { Conversation, Message } from "./conversation";

export const FRAME = {
  send: "message.send",
  newMessage: "message.new",
  opened: "conversation.opened",
  closed: "conversation.closed",
  error: "error",
} as const;

export type MessageNew = { conversationId: string; message: Message; clientId: string | null };
export type ConversationClosed = { conversationId: string; reason: string | null; closedAt: string | null };
export type SendError = { clientId: string; code: string; message: string };

const str = (value: unknown): value is string => typeof value === "string";

export function parseMessageNew(frame: Frame): MessageNew | null {
  const message = frame.message as Partial<Message> | undefined;
  if (!str(frame.conversation_id) || !message || typeof message.id !== "number" || !str(message.body)) {
    return null;
  }
  return {
    conversationId: frame.conversation_id,
    message: message as Message,
    clientId: str(frame.client_id) ? frame.client_id : null,
  };
}

export function parseOpened(frame: Frame): Conversation | null {
  const conversation = frame.conversation as Partial<Conversation> | undefined;
  return conversation && str(conversation.id) && Array.isArray(conversation.participants)
    ? (conversation as Conversation)
    : null;
}

export function parseClosed(frame: Frame): ConversationClosed | null {
  if (!str(frame.conversation_id)) return null;
  return {
    conversationId: frame.conversation_id,
    reason: str(frame.reason) ? frame.reason : null,
    closedAt: str(frame.closed_at) ? frame.closed_at : null,
  };
}

/** Only errors answering one of our own sends carry a client id. */
export function parseSendError(frame: Frame): SendError | null {
  if (!str(frame.client_id)) return null;
  return {
    clientId: frame.client_id,
    code: str(frame.code) ? frame.code : "ERROR",
    message: str(frame.message) ? frame.message : "Your message wasn't sent.",
  };
}

export function sendFrame(conversationId: string, clientId: string, body: string): Frame {
  return { type: FRAME.send, conversation_id: conversationId, client_id: clientId, body };
}
