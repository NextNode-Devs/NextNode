"use client";

import { InboxIcon, LockIcon } from "lucide-react";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

import { INBOX_TAB_LABEL, INBOX_TABS, unreadByTab, unreadText, type InboxItem, type InboxTab } from "@/entities/conversation";
import { formatMessageTime } from "@/shared/lib/format-date";
import { underConstruction } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";

type Props = { items: InboxItem[]; accountRole: "developer" | "client" };

const EMPTY: Record<InboxTab, string> = {
  team: "No team chats yet. Join or lead a team and its chat appears here.",
  messages: "No direct or hiring messages yet.",
  applications: "No applications yet.",
};

/**
 * Team chats, direct and hiring messages, and applications, each tab with its
 * unread count. Radix Tabs: arrow keys move between tabs, Tab enters the panel.
 */
export function InboxTabs({ items, accountRole }: Props) {
  const unread = unreadByTab(items);
  return (
    <Tabs.Root defaultValue="team" className="space-y-3">
      <Tabs.List aria-label="Conversations" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1">
        {INBOX_TABS.map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-muted-foreground",
              "rounded-t-md hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
              "data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground",
            )}
          >
            {INBOX_TAB_LABEL[tab]}
            {unread[tab] > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums" aria-hidden>
                {unread[tab]}
              </span>
            ) : null}
            <span className="sr-only">, {unreadText(unread[tab])}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {INBOX_TABS.map((tab) => (
        <Tabs.Content key={tab} value={tab} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {tab === "team" && accountRole === "client" ? (
            <Note icon={<LockIcon aria-hidden />}>
              Team chats are private to each team. Talk to your Team Lead in Direct and hiring.
            </Note>
          ) : (
            <TabItems items={items.filter((item) => item.tab === tab)} empty={EMPTY[tab]} />
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

function TabItems({ items, empty }: { items: InboxItem[]; empty: string }) {
  if (items.length === 0) return <Note icon={<InboxIcon aria-hidden />}>{empty}</Note>;
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => underConstruction("Open sample conversation")}
            className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
          >
            <span className="min-w-0 space-y-0.5 text-sm">
              <span className={cn("block break-words", item.unread_count > 0 && "font-semibold")}>{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
              <span className="block truncate text-muted-foreground">{item.preview}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
              {formatMessageTime(item.updated_at)}
              {item.unread_count > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-primary-foreground tabular-nums">
                  {item.unread_count}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
      {icon}
      {children}
    </p>
  );
}
