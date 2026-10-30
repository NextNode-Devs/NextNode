/** The conversation list as a pure reducer: loaded from REST, patched by socket frames. */
import type { Conversation, ConversationClosed, MessageNew } from "@/entities/conversation";

export type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; conversations: Conversation[] };

export type ListAction =
  | { type: "loaded"; conversations: Conversation[] }
  | { type: "failed"; message: string }
  | { type: "opened"; conversation: Conversation }
  | { type: "message"; frame: MessageNew; myAccountId: number; activeId: string | null }
  | { type: "closed"; frame: ConversationClosed }
  | { type: "read"; conversationId: string };

function activity(c: Conversation): string {
  return c.last_message?.created_at ?? c.created_at ?? "";
}

function sorted(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => activity(b).localeCompare(activity(a)));
}

export function listReducer(state: ListState, action: ListAction): ListState {
  if (action.type === "loaded") return { status: "ready", conversations: sorted(action.conversations) };
  if (action.type === "failed") return { status: "error", message: action.message };
  if (state.status !== "ready") return state;

  const list = state.conversations;
  switch (action.type) {
    case "opened":
      if (list.some((c) => c.id === action.conversation.id)) return state;
      return { status: "ready", conversations: sorted([action.conversation, ...list]) };
    case "message": {
      const { frame, myAccountId, activeId } = action;
      const fromOther = frame.message.author_id !== myAccountId;
      const next = list.map((c) =>
        c.id === frame.conversationId
          ? {
              ...c,
              last_message: frame.message,
              unread_count: fromOther && c.id !== activeId ? c.unread_count + 1 : c.unread_count,
            }
          : c,
      );
      return { status: "ready", conversations: sorted(next) };
    }
    case "closed":
      return {
        status: "ready",
        conversations: list.map((c) =>
          c.id === action.frame.conversationId
            ? { ...c, status: "closed", close_reason: action.frame.reason, closed_at: action.frame.closedAt }
            : c,
        ),
      };
    case "read":
      return {
        status: "ready",
        conversations: list.map((c) => (c.id === action.conversationId ? { ...c, unread_count: 0 } : c)),
      };
  }
}
