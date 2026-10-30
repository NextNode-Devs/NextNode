"use client";

import { InboxIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { otherParticipant, SUBJECT_LABEL, type Conversation } from "@/entities/conversation";
import { formatMessageTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import { useConversationList } from "../model/use-conversation-list";

type Props = {
  myAccountId: number;
  /** The open conversation, marked as current and never counted unread. */
  activeId?: string | null;
  /** Show only the most recent few (dashboard). */
  limit?: number;
  /** What to say when there are none yet. */
  emptyText?: string;
};

const DEFAULT_EMPTY =
  "No conversations yet. One opens when a developer applies to lead a project or a client invites one, " +
  "and when a Team Lead recruits for their team.";

/** Your hiring conversations, most recent first, with unread counts. Updates live. */
export function ConversationList({ myAccountId, activeId = null, limit, emptyText = DEFAULT_EMPTY }: Props) {
  const state = useConversationList(myAccountId, activeId);

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading conversations" className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Conversations couldn&apos;t be loaded: {state.message}
      </p>
    );
  }
  if (state.conversations.length === 0) {
    return (
      <p className="flex items-start gap-3 text-sm text-muted-foreground">
        <InboxIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {emptyText}
      </p>
    );
  }

  const shown = limit ? state.conversations.slice(0, limit) : state.conversations;
  return (
    <ul className="flex flex-col gap-1" aria-label="Conversations">
      {shown.map((conversation) => (
        <li key={conversation.id}>
          <Row conversation={conversation} myAccountId={myAccountId} active={conversation.id === activeId} />
        </li>
      ))}
    </ul>
  );
}

function Row({ conversation, myAccountId, active }: { conversation: Conversation; myAccountId: number; active: boolean }) {
  const other = otherParticipant(conversation, myAccountId);
  const last = conversation.last_message;
  const unread = active ? 0 : conversation.unread_count;
  const preview = last ? `${last.author_id === myAccountId ? "You: " : ""}${last.body}` : "No messages yet";

  return (
    <Link
      href={`/conversations/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col gap-0.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "aria-[current=page]:bg-muted",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate", unread > 0 ? "font-semibold" : "font-medium")}>
          {other.display_name}
        </span>
        {conversation.status === "closed" ? (
          <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Closed" />
        ) : null}
        {unread > 0 ? (
          <Badge className="h-5 min-w-5 px-1.5 tabular-nums" aria-label={`${unread} unread`}>
            {unread > 99 ? "99+" : unread}
          </Badge>
        ) : null}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {SUBJECT_LABEL[conversation.subject_kind]}
        {last?.created_at ? ` · ${formatMessageTime(last.created_at)}` : ""}
      </span>
      <span className={cn("truncate text-xs", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
        {preview}
      </span>
    </Link>
  );
}
