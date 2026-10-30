"use client";

import { useEffect, useReducer } from "react";

import { FRAME, listConversations, parseClosed, parseMessageNew, parseOpened } from "@/entities/conversation";
import { useApiClient } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";

import { listReducer } from "./list-state";

/** The viewer's conversations, kept current by the socket (new, messaged, closed). */
export function useConversationList(myAccountId: number, activeId: string | null) {
  const api = useApiClient();
  const { connection, state: socket } = useRealtime();
  const [state, dispatch] = useReducer(listReducer, { status: "loading" });

  // (Re)load on mount and whenever live updates come back, so nothing missed while offline stays missing.
  const live = socket.status === "connected";
  useEffect(() => {
    let cancelled = false;
    void listConversations(api).then((result) => {
      if (cancelled) return;
      if (result.ok) dispatch({ type: "loaded", conversations: result.data });
      else dispatch({ type: "failed", message: result.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [api, live]);

  // Opening a conversation reads it.
  useEffect(() => {
    if (activeId) dispatch({ type: "read", conversationId: activeId });
  }, [activeId]);

  useEffect(() => {
    if (!connection) return;
    const offs = [
      connection.on(FRAME.opened, (frame) => {
        const conversation = parseOpened(frame);
        if (conversation) dispatch({ type: "opened", conversation });
      }),
      connection.on(FRAME.newMessage, (frame) => {
        const parsed = parseMessageNew(frame);
        if (parsed) dispatch({ type: "message", frame: parsed, myAccountId, activeId });
      }),
      connection.on(FRAME.closed, (frame) => {
        const parsed = parseClosed(frame);
        if (parsed) dispatch({ type: "closed", frame: parsed });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [connection, myAccountId, activeId]);

  return state;
}
