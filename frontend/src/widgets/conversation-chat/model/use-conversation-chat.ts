"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  FRAME,
  getConversation,
  listMessages,
  markRead,
  PAGE_SIZE,
  parseClosed,
  parseMessageNew,
  parseSendError,
  sendFrame,
} from "@/entities/conversation";
import { useApiClient } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";

import { chatReducer, INITIAL, latestId } from "./chat-state";

/** How long a sent message may wait for the server's `message.new` before it counts as failed. */
export const SEND_TIMEOUT_MS = 15_000;

const NOT_CONNECTED = "You're not connected right now. Wait for “Live” in the header, then retry.";

/**
 * One conversation, live: loads it with its latest messages, follows the
 * socket (new messages, refusals, closing), catches up after a reconnect,
 * keeps the read marker current and sends messages with pending/failed states.
 */
export function useConversationChat(conversationId: string, myAccountId: number) {
  const api = useApiClient();
  const { connection, state: socket } = useRealtime();
  const [state, dispatch] = useReducer(chatReducer, INITIAL);
  const stateRef = useRef(state);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const readUpTo = useCallback(
    (messageId: number | null) => {
      if (messageId !== null && document.visibilityState === "visible") markRead(api, conversationId, messageId);
    },
    [api, conversationId],
  );

  // Load the conversation and its latest page.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [conversation, messages] = await Promise.all([
        getConversation(api, conversationId),
        listMessages(api, conversationId),
      ]);
      if (cancelled) return;
      if (!conversation.ok || !messages.ok) {
        const error = !conversation.ok ? conversation.error : !messages.ok ? messages.error : null;
        dispatch({
          type: "load-failed",
          notFound: error?.code === "NOT_FOUND",
          message: error?.message ?? "This conversation could not be loaded.",
        });
        return;
      }
      dispatch({ type: "loaded", conversation: conversation.data, messages: messages.data, pageSize: PAGE_SIZE });
      readUpTo(messages.data.at(-1)?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, conversationId, readUpTo]);

  // Live frames for this conversation.
  useEffect(() => {
    if (!connection) return;
    const offs = [
      connection.on(FRAME.newMessage, (frame) => {
        const parsed = parseMessageNew(frame);
        if (!parsed || parsed.conversationId !== conversationId) return;
        dispatch({ type: "received", message: parsed.message, clientId: parsed.clientId });
        if (parsed.message.author_id !== myAccountId) readUpTo(parsed.message.id);
      }),
      connection.on(FRAME.error, (frame) => {
        const parsed = parseSendError(frame);
        if (parsed) dispatch({ type: "send-failed", clientId: parsed.clientId, error: parsed.message });
      }),
      connection.on(FRAME.closed, (frame) => {
        const parsed = parseClosed(frame);
        if (parsed?.conversationId === conversationId) {
          dispatch({ type: "closed", reason: parsed.reason, closedAt: parsed.closedAt });
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [connection, conversationId, myAccountId, readUpTo]);

  // After a dropped connection comes back, fetch what was missed.
  const wasConnected = useRef(false);
  const dropped = useRef(false);
  useEffect(() => {
    if (socket.status !== "connected") {
      if (wasConnected.current) dropped.current = true;
      return;
    }
    wasConnected.current = true;
    if (!dropped.current) return;
    dropped.current = false;
    const after = latestId(stateRef.current);
    if (stateRef.current.status !== "ready" || after === null) return;
    void listMessages(api, conversationId, { after, limit: 100 }).then((result) => {
      if (!result.ok) return;
      dispatch({ type: "caught-up", messages: result.data });
      const last = result.data.at(-1);
      if (last && last.author_id !== myAccountId) readUpTo(last.id);
    });
  }, [socket.status, api, conversationId, myAccountId, readUpTo]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const send = useCallback(
    (body: string) => {
      const clientId = crypto.randomUUID();
      dispatch({ type: "send-started", clientId, body });
      const sent = connection?.send(sendFrame(conversationId, clientId, body)) ?? false;
      if (!sent) {
        dispatch({ type: "send-failed", clientId, error: NOT_CONNECTED });
        return;
      }
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        dispatch({ type: "send-timed-out", clientId });
      }, SEND_TIMEOUT_MS);
      timers.current.add(timer);
    },
    [connection, conversationId],
  );

  const retry = useCallback(
    (clientId: string) => {
      const failed = stateRef.current.pending.find((p) => p.clientId === clientId);
      if (!failed) return;
      dispatch({ type: "retry", clientId });
      send(failed.body);
    },
    [send],
  );

  const dismiss = useCallback((clientId: string) => dispatch({ type: "dismiss", clientId }), []);

  const loadOlder = useCallback(async () => {
    const before = stateRef.current.messages[0]?.id;
    if (before === undefined || stateRef.current.loadingOlder) return;
    dispatch({ type: "older-started" });
    const result = await listMessages(api, conversationId, { before });
    if (result.ok) dispatch({ type: "older-loaded", messages: result.data, pageSize: PAGE_SIZE });
    else dispatch({ type: "older-failed", message: result.error.message });
  }, [api, conversationId]);

  return { state, connected: socket.status === "connected", send, retry, dismiss, loadOlder };
}
