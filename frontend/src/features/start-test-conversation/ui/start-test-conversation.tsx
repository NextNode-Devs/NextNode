"use client";

import { FlaskConicalIcon, Loader2Icon, MessageSquarePlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Conversation } from "@/entities/conversation";
import { useApiClient } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Partner = { account_id: number; display_name: string; role: "developer" | "client" };

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; partners: Partner[] };

/**
 * Development only (`next dev` + DJANGO_ENV=development): start a chat with
 * another local account to try conversations before Hire Lead opens real ones.
 */
export function StartTestConversation() {
  const api = useApiClient();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [starting, setStarting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.get<Partner[]>("/api/dev/test-partners/").then((result) => {
      if (cancelled) return;
      setLoad(result.ok ? { status: "ready", partners: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const start = async (partner: Partner) => {
    setStarting(partner.account_id);
    setError(null);
    const result = await api.post<Conversation>("/api/dev/test-conversations/", { account_id: partner.account_id });
    if (result.ok) {
      router.push(`/conversations/${result.data.id}`);
      return; // keep the spinner until the chat opens
    }
    setStarting(null);
    setError(result.error.message);
  };

  return (
    <Card size="sm" className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FlaskConicalIcon className="size-4" aria-hidden />
          <h2>Start a test conversation</h2>
        </CardTitle>
        <CardDescription>
          Development only. Real conversations open when someone applies or is invited. Pick another local
          account to try the chat; sign in as them in a second browser to reply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {load.status === "loading" ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : null}
        {load.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {load.message}
          </p>
        ) : null}
        {load.status === "ready" && load.partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other accounts yet. Sign up a second account (another browser or a private window) first.
          </p>
        ) : null}
        {load.status === "ready" ? (
          <ul className="flex flex-col gap-1">
            {load.partners.map((partner) => (
              <li key={partner.account_id}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={starting !== null}
                  onClick={() => void start(partner)}
                >
                  {starting === partner.account_id ? (
                    <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <MessageSquarePlusIcon aria-hidden />
                  )}
                  <span className="truncate">Chat with {partner.display_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{partner.role}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
