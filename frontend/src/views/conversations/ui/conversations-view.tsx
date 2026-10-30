import { MessagesSquareIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { isConversationId } from "@/entities/conversation";
import { getViewer, routeFor } from "@/entities/viewer";
import { StartTestConversation } from "@/features/start-test-conversation";
import { RealtimeProvider } from "@/shared/api/realtime";
import { isAuthConfigured, publicEnv } from "@/shared/config/env.public";
import { cn } from "@/shared/lib/utils";
import { LoadError, LoadingCards } from "@/shared/ui/load-states";
import { AppHeader } from "@/widgets/app-header";
import { ConnectionStatus } from "@/widgets/connection-status";
import { ConversationChat } from "@/widgets/conversation-chat";
import { ConversationList } from "@/widgets/conversation-list";

type Props = { conversationId?: Promise<string> };

/**
 * Hiring conversations: the list beside the open conversation. On a phone it
 * shows one at a time — the list, or the conversation with a way back.
 */
export function ConversationsView({ conversationId }: Props) {
  const page = (
    <>
      <AppHeader current="conversations" status={isAuthConfigured() ? <ConnectionStatus /> : null} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading your conversations" />}>
          <Conversations conversationId={conversationId} />
        </Suspense>
      </main>
    </>
  );
  return isAuthConfigured() ? <RealtimeProvider>{page}</RealtimeProvider> : page;
}

async function Conversations(props: Props) {
  const conversationId = props.conversationId ? await props.conversationId : undefined;
  const path = conversationId ? `/conversations/${conversationId}` : "/conversations";
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=${path}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") {
    return (
      <>
        <h1 className="sr-only">Conversations</h1>
        <LoadError title="We couldn't load your conversations" message={route.message} />
      </>
    );
  }

  const me = route.viewer.account.id;
  const open = conversationId ?? null;
  return (
    <>
      <header className={cn("space-y-1", open && "hidden md:block")}>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Conversations</h1>
        <p className="text-muted-foreground">
          Hiring conversations with clients and developers. Decisions happen here.
        </p>
      </header>
      {open ? <h1 className="sr-only md:hidden">Conversation</h1> : null}

      <div className="grid items-start gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Your conversations" className={cn("space-y-4", open && "hidden md:block")}>
          <ConversationList myAccountId={me} activeId={open} />
          {publicEnv.devTools ? <StartTestConversation /> : null}
        </section>

        <section aria-label="Open conversation" className={cn("min-w-0", !open && "hidden md:block")}>
          {open && isConversationId(open) ? (
            <ConversationChat key={open} conversationId={open} myAccountId={me} />
          ) : open ? (
            <LoadError title="Conversation not found" message="That link isn't a valid conversation." />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <MessagesSquareIcon className="size-6" aria-hidden />
              <p>Select a conversation to read and reply.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
