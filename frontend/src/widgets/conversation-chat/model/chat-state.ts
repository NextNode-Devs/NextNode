/**
 * Everything the chat window shows, as one pure reducer so every state change
 * (history, live messages, sends in flight, failures, closing) is testable
 * without a socket or a server.
 */
import type { Conversation, Message } from "@/entities/conversation";

export type Pending = {
  clientId: string;
  body: string;
  state: "sending" | "failed";
  error?: string;
};

export type ChatState = {
  status: "loading" | "ready" | "not-found" | "error";
  error: string | null;
  conversation: Conversation | null;
  /** Saved messages, oldest first, each id once. */
  messages: Message[];
  /** Sent from this tab, not yet confirmed by the server (or refused). */
  pending: Pending[];
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: string | null;
};

export type ChatAction =
  | { type: "loaded"; conversation: Conversation; messages: Message[]; pageSize: number }
  | { type: "load-failed"; notFound: boolean; message: string }
  | { type: "older-started" }
  | { type: "older-loaded"; messages: Message[]; pageSize: number }
  | { type: "older-failed"; message: string }
  | { type: "received"; message: Message; clientId: string | null }
  | { type: "caught-up"; messages: Message[] }
  | { type: "send-started"; clientId: string; body: string }
  | { type: "send-failed"; clientId: string; error: string }
  | { type: "send-timed-out"; clientId: string }
  | { type: "retry"; clientId: string }
  | { type: "dismiss"; clientId: string }
  | { type: "closed"; reason: string | null; closedAt: string | null };

export const INITIAL: ChatState = {
  status: "loading",
  error: null,
  conversation: null,
  messages: [],
  pending: [],
  hasOlder: false,
  loadingOlder: false,
  olderError: null,
};

export const TIMED_OUT = "No answer from the server, so it may not have been sent.";

/** Merges saved messages, keeping each id once, oldest first. */
export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function updatePending(state: ChatState, clientId: string, change: (p: Pending) => Pending | null): ChatState {
  const pending = state.pending.flatMap((p) => {
    if (p.clientId !== clientId) return [p];
    const next = change(p);
    return next ? [next] : [];
  });
  return { ...state, pending };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        status: "ready",
        error: null,
        conversation: action.conversation,
        messages: mergeMessages(state.messages, action.messages),
        hasOlder: action.messages.length >= action.pageSize,
      };
    case "load-failed":
      return { ...state, status: action.notFound ? "not-found" : "error", error: action.message };
    case "older-started":
      return { ...state, loadingOlder: true, olderError: null };
    case "older-loaded":
      return {
        ...state,
        loadingOlder: false,
        messages: mergeMessages(state.messages, action.messages),
        hasOlder: action.messages.length >= action.pageSize,
      };
    case "older-failed":
      return { ...state, loadingOlder: false, olderError: action.message };
    case "received": {
      const next = { ...state, messages: mergeMessages(state.messages, [action.message]) };
      return action.clientId ? updatePending(next, action.clientId, () => null) : next;
    }
    case "caught-up":
      return { ...state, messages: mergeMessages(state.messages, action.messages) };
    case "send-started":
      return {
        ...state,
        pending: [...state.pending, { clientId: action.clientId, body: action.body, state: "sending" }],
      };
    case "send-failed":
      return updatePending(state, action.clientId, (p) => ({ ...p, state: "failed", error: action.error }));
    case "send-timed-out":
      return updatePending(state, action.clientId, (p) =>
        p.state === "sending" ? { ...p, state: "failed", error: TIMED_OUT } : p,
      );
    case "retry":
    case "dismiss":
      // A retry is sent again under a new client id, so the old entry goes either way.
      return updatePending(state, action.clientId, () => null);
    case "closed":
      if (!state.conversation) return state;
      return {
        ...state,
        conversation: {
          ...state.conversation,
          status: "closed",
          close_reason: action.reason,
          closed_at: action.closedAt,
        },
        // Anything still in flight can no longer be accepted.
        pending: state.pending.map((p) =>
          p.state === "sending" ? { ...p, state: "failed", error: "This conversation was closed." } : p,
        ),
      };
  }
}

export function latestId(state: ChatState): number | null {
  return state.messages.at(-1)?.id ?? null;
}
