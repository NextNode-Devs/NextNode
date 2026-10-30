import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { Conversation, Message } from "../model/conversation";

/** Messages per page, both for history on open and for "Load earlier messages". */
export const PAGE_SIZE = 50;

export function listConversations(api: BrowserApi): Promise<ApiResult<Conversation[]>> {
  return api.get<Conversation[]>("/api/conversations/");
}

export function getConversation(api: BrowserApi, id: string): Promise<ApiResult<Conversation>> {
  return api.get<Conversation>(`/api/conversations/${id}/`);
}

type Page = { before?: number; after?: number; limit?: number };

/** Oldest first. `before` pages history backwards; `after` catches up after a reconnect. */
export function listMessages(api: BrowserApi, id: string, page: Page = {}): Promise<ApiResult<Message[]>> {
  const query = new URLSearchParams();
  if (page.before !== undefined) query.set("before", String(page.before));
  if (page.after !== undefined) query.set("after", String(page.after));
  query.set("limit", String(page.limit ?? PAGE_SIZE));
  return api.get<Message[]>(`/api/conversations/${id}/messages/?${query}`);
}

/** Best effort: a failed read marker only leaves an unread count too high. */
export function markRead(api: BrowserApi, id: string, messageId: number): void {
  void api.post(`/api/conversations/${id}/read/`, { message_id: messageId });
}
