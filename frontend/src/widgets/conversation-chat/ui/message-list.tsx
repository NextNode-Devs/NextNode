"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { nameOf, type Conversation, type Message } from "@/entities/conversation";
import { formatMessageTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/shadcn/button";

import type { Pending } from "../model/chat-state";

type Props = {
  conversation: Conversation;
  messages: Message[];
  pending: Pending[];
  myAccountId: number;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: string | null;
  onLoadOlder: () => void;
  onRetry: (clientId: string) => void;
  onDismiss: (clientId: string) => void;
};

const NEAR_BOTTOM_PX = 120;

/** The conversation, oldest at the top. Follows new messages unless you've scrolled up to read. */
export function MessageList(props: Props) {
  const { conversation, messages, pending, myAccountId } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const firstId = useRef<number | null>(null);
  const heightBefore = useRef(0);

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const oldestNow = messages[0]?.id ?? null;
    const prependedOlder = firstId.current !== null && oldestNow !== null && oldestNow < firstId.current;
    if (prependedOlder) {
      box.scrollTop += box.scrollHeight - heightBefore.current; // keep your place
    } else if (stick.current) {
      box.scrollTop = box.scrollHeight;
    }
    firstId.current = oldestNow;
    heightBefore.current = box.scrollHeight;
  }, [messages, pending]);

  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    heightBefore.current = box.scrollHeight;
  };

  const lastTime = messages.at(-1)?.created_at ?? undefined;
  const empty = messages.length === 0 && pending.length === 0;

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="h-[min(60vh,32rem)] min-h-64 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
    >
      {props.hasOlder ? (
        <div className="mb-4 flex flex-col items-center gap-1">
          <Button variant="ghost" size="sm" onClick={props.onLoadOlder} disabled={props.loadingOlder}>
            {props.loadingOlder ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {props.loadingOlder ? "Loading…" : "Load earlier messages"}
          </Button>
          {props.olderError ? <p className="text-xs text-destructive">{props.olderError}</p> : null}
        </div>
      ) : null}

      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No messages yet. Say hello to start the conversation.
        </p>
      ) : null}

      <ol role="log" aria-live="polite" aria-label="Messages" className="flex flex-col gap-3">
        {messages.map((message) => {
          const mine = message.author_id === myAccountId;
          return (
            <Bubble
              key={message.id}
              mine={mine}
              author={mine ? "You" : nameOf(conversation, message.author_id)}
              time={formatMessageTime(message.created_at, lastTime)}
              body={message.body}
            />
          );
        })}
        {pending.map((p) => (
          <Bubble key={p.clientId} mine author="You" body={p.body} faded={p.state === "sending"}>
            {p.state === "sending" ? (
              <span className="text-xs text-muted-foreground">Sending…</span>
            ) : (
              <span className="flex flex-wrap items-center justify-end gap-x-2 text-xs text-destructive">
                <AlertCircleIcon className="size-3.5" aria-hidden />
                <span>Not sent. {p.error}</span>
                <Button variant="link" size="xs" className="h-auto p-0" onClick={() => props.onRetry(p.clientId)}>
                  Retry
                </Button>
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={() => props.onDismiss(p.clientId)}
                >
                  Remove
                </Button>
              </span>
            )}
          </Bubble>
        ))}
      </ol>
    </div>
  );
}

function Bubble(props: {
  mine: boolean;
  author: string;
  body: string;
  time?: string;
  faded?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className={cn("flex flex-col gap-1", props.mine ? "items-end" : "items-start")}>
      <span className="px-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{props.author}</span>
        {props.time ? <span> · {props.time}</span> : null}
      </span>
      <p
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap sm:max-w-[75%]",
          props.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
          props.faded && "opacity-70",
        )}
      >
        {props.body}
      </p>
      {props.children}
    </li>
  );
}
