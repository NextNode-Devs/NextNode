"use client";

import { MessagesSquareIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { getProjectLeadChats, LEAD_STATUS_TAG, LEAD_UPDATED, type LeadChat } from "@/entities/lead-candidacy";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { useRealtime } from "@/shared/api/realtime";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";
import { ConversationChat } from "@/widgets/conversation-chat";

type Props = {
  projectId: number;
  myAccountId: number;
  /** The project's client: sees every candidate and picks whose chat to open. */
  isOwner: boolean;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; chats: LeadChat[] };

/** Which chat opens first: the hired Lead, else the first still in play, else the oldest. */
export function firstChat(chats: LeadChat[]): LeadChat | undefined {
  return (
    chats.find((c) => c.status === "hired") ??
    chats.find((c) => c.status === "invited" || c.status === "candidate") ??
    chats[0]
  );
}

/**
 * The project's hiring conversations, on its own page (#4). The client sees
 * every application and invitation and opens one at a time; a developer sees
 * their own conversation with the client. Any Hire Lead decision (theirs or the
 * other person's, live) refreshes the list and the rest of the page.
 */
export function ProjectChats({ projectId, myAccountId, isOwner, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const { connection } = useRealtime();
  const headingId = useId();
  const [state, setState] = useState<State>({ status: "loading" });
  // `?chat=<id>` (e.g. right after inviting someone) opens that conversation first.
  const [openId, setOpenId] = useState<string | null>(useSearchParams().get("chat"));

  const load = useCallback(async () => {
    const result = await getProjectLeadChats(api, projectId);
    setState(result.ok ? { status: "ready", chats: result.data } : { status: "error", message: result.error.message });
  }, [api, projectId]);

  useEffect(() => {
    let current = true;
    void getProjectLeadChats(api, projectId).then((result) => {
      if (current) {
        setState(result.ok ? { status: "ready", chats: result.data } : { status: "error", message: result.error.message });
      }
    });
    return () => {
      current = false;
    };
  }, [api, projectId]);

  useEffect(() => {
    if (!connection) return;
    return connection.on(LEAD_UPDATED, () => {
      void load();
      router.refresh(); // the team, status and actions on the page may have changed
    });
  }, [connection, load, router]);

  if (state.status === "loading") {
    return isOwner ? <Skeleton className="h-40 w-full rounded-xl" aria-label="Loading conversations" /> : null;
  }
  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>We couldn&apos;t load this project&apos;s conversations</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {state.message}
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { chats } = state;
  if (!isOwner && chats.length === 0) return null; // nothing yet: "Apply to lead" is in the sidebar
  const open = chats.find((c) => c.candidacy_id === openId) ?? firstChat(chats);

  return (
    <section id="hiring" aria-labelledby={headingId} className="scroll-mt-6 space-y-3">
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          {isOwner ? "Team Lead conversations" : "Your conversation with the client"}
        </h2>
        {isOwner ? (
          <p className="text-sm text-muted-foreground">
            Developers who applied to lead this project, or that you invited. Talk, then hire one as Team Lead.
          </p>
        ) : null}
      </div>

      {chats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <MessagesSquareIcon className="size-6" aria-hidden />
          <p>No applications yet. Developers can apply from this page, or you can invite one from their portfolio.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/developers">Find developers</Link>
          </Button>
        </div>
      ) : (
        <div className={cn("grid items-start gap-4", isOwner && "md:grid-cols-[14rem_minmax(0,1fr)]")}>
          {isOwner ? (
            <ul aria-label="Candidates" className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
              {chats.map((chat) => (
                <li key={chat.candidacy_id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={chat.candidacy_id === open?.candidacy_id}
                    onClick={() => setOpenId(chat.candidacy_id)}
                    className="flex w-full min-w-40 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:border-highlight aria-pressed:bg-accent/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{chat.developer_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {chat.kind === "application" ? "Applied" : "You invited"}
                      </span>
                    </span>
                    <Badge variant="secondary">{LEAD_STATUS_TAG[chat.status]}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="min-w-0">
            {open?.conversation_id ? (
              <ConversationChat
                key={open.conversation_id}
                conversationId={open.conversation_id}
                myAccountId={myAccountId}
                embedded
              />
            ) : (
              <p className="text-sm text-muted-foreground">This conversation isn&apos;t available.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
