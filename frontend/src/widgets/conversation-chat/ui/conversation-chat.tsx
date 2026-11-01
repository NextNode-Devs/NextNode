"use client";

import { ArrowLeftIcon, LockIcon, MessageSquareOffIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { otherParticipant, SUBJECT_LABEL } from "@/entities/conversation";
import { LeadDecisions } from "@/features/hire-team-lead";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card } from "@/shared/ui/shadcn/card";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import { useConversationChat } from "../model/use-conversation-chat";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

type Props = {
  conversationId: string;
  myAccountId: number;
  /** Shown inside another page (a project's): no "All conversations" link. */
  embedded?: boolean;
};

const BACK = (
  <Link
    href="/conversations"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
  >
    <ArrowLeftIcon className="size-4" aria-hidden /> All conversations
  </Link>
);

/** One hiring conversation: live messages, history and the message box. */
export function ConversationChat({ conversationId, myAccountId, embedded = false }: Props) {
  const chat = useConversationChat(conversationId, myAccountId);
  const { state } = chat;

  if (state.status === "loading") {
    return (
      <Card className="gap-0 p-0" role="status" aria-label="Loading the conversation">
        <div className="space-y-2 border-b p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
          <Skeleton className="h-10 w-3/5" />
        </div>
      </Card>
    );
  }

  if (state.status !== "ready" || !state.conversation) {
    const notFound = state.status === "not-found";
    return (
      <div className="space-y-3">
        {embedded ? null : BACK}
        <Alert variant={notFound ? "default" : "destructive"}>
          {notFound ? <MessageSquareOffIcon aria-hidden /> : <TriangleAlertIcon aria-hidden />}
          <AlertTitle>{notFound ? "Conversation not found" : "We couldn't load this conversation"}</AlertTitle>
          <AlertDescription>
            {notFound
              ? "It doesn't exist, or you're not part of it. Only the two people in a conversation can open it."
              : `${state.error ?? "Something went wrong."} Try again in a moment.`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const conversation = state.conversation;
  const other = otherParticipant(conversation, myAccountId);
  const closed = conversation.status === "closed";

  return (
    <div className="space-y-3">
      {embedded ? null : BACK}
      <Card className="gap-0 overflow-hidden p-0">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{other.display_name}</h2>
            <p className="text-sm text-muted-foreground">{SUBJECT_LABEL[conversation.subject_kind]}</p>
          </div>
          {closed ? (
            <Badge variant="secondary">
              <LockIcon aria-hidden /> Closed
            </Badge>
          ) : null}
        </header>

        {conversation.subject_kind === "lead_application" || conversation.subject_kind === "lead_invitation" ? (
          <LeadDecisions
            candidacyId={conversation.subject_id}
            myAccountId={myAccountId}
            developerName={other.display_name}
          />
        ) : null}

        <MessageList
          conversation={conversation}
          messages={state.messages}
          pending={state.pending}
          myAccountId={myAccountId}
          hasOlder={state.hasOlder}
          loadingOlder={state.loadingOlder}
          olderError={state.olderError}
          onLoadOlder={() => void chat.loadOlder()}
          onRetry={chat.retry}
          onDismiss={chat.dismiss}
        />

        {closed ? (
          <div role="status" className="flex items-start gap-2 border-t bg-muted/50 px-4 py-3 text-sm">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              <span className="font-medium">This conversation is closed</span>
              {conversation.close_reason ? `: ${conversation.close_reason}` : "."} You can still read it, but no
              new messages can be sent.
            </p>
          </div>
        ) : (
          <Composer
            unavailable={chat.connected ? null : "Connecting to live chat… you can send once it says “Live”."}
            onSend={chat.send}
          />
        )}
      </Card>
    </div>
  );
}
