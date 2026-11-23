"use client";

import { CopyIcon, EyeIcon, Link2OffIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { describeInviteLink, InviteLinkStatusBadge, inviteLinkPath, type InviteLink } from "@/entities/invite-link";
import { toast, underConstruction } from "@/shared/lib/toast";
import { useHydrated } from "@/shared/lib/use-hydrated";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Input } from "@/shared/ui/shadcn/input";

import { copyText } from "../model/copy-text";
import { CreateLinkDialog } from "./create-link-dialog";

type Props = {
  links: { active: InviteLink | null; earlier: InviteLink[] };
  /** The request time (ISO), from the server, so the expiry text matches on both sides. */
  now: string;
};

/**
 * PROTOTYPE (NN-26 #90): the Team Lead's time-limited invite link, beside the
 * Phase 1 team roster. Copying is real (the clipboard); creating and revoking
 * a link are under construction. Earlier links open the screen the invitee
 * would see, so the expired and used screens can be checked.
 */
export function InviteLinkCard({ links, now }: Props) {
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const [copyFailed, setCopyFailed] = useState(false);
  const { active, earlier } = links;

  // The origin exists only in the browser; the server renders the path.
  const urlOf = (link: InviteLink) =>
    hydrated ? `${window.location.origin}${inviteLinkPath(link.token)}` : inviteLinkPath(link.token);

  const copy = async (link: InviteLink) => {
    const ok = await copyText(urlOf(link));
    setCopyFailed(!ok);
    if (ok) {
      toast({ title: "Invite link copied", description: `It works once. ${describeInviteLink(link, now)}.`, tone: "success" });
    } else {
      toast({ title: "Couldn't copy the link", description: "Select the link and copy it yourself.", tone: "error" });
      input.current?.select();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <h2>Invite by link</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>Send a developer a link to join. Each link works once and expires.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {active ? (
          <div className="space-y-2">
            <label htmlFor={`${ids}-url`} className="font-medium">
              Current link
            </label>
            <Input
              ref={input}
              id={`${ids}-url`}
              readOnly
              value={urlOf(active)}
              aria-describedby={`${ids}-expiry${copyFailed ? ` ${ids}-copy-error` : ""}`}
              onFocus={(event) => event.currentTarget.select()}
            />
            <p id={`${ids}-expiry`} className="text-muted-foreground">
              {describeInviteLink(active, now)}
            </p>
            {copyFailed ? (
              <p id={`${ids}-copy-error`} role="alert" className="flex items-start gap-1.5 text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Copying didn&apos;t work here. The link is selected: copy it with your keyboard.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void copy(active)}>
                <CopyIcon aria-hidden data-icon="inline-start" />
                Copy invite link
              </Button>
              <CreateLinkDialog hasActive />
              <Button size="sm" variant="ghost" onClick={() => underConstruction("Revoke invite link")}>
                <Link2OffIcon aria-hidden data-icon="inline-start" />
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-medium">No active invite link</p>
            <p className="text-muted-foreground">Create one to send to a developer. You choose when it expires.</p>
            <CreateLinkDialog hasActive={false} />
          </div>
        )}
        {earlier.length ? (
          <div className="space-y-2">
            <h3 className="font-medium">Earlier links</h3>
            <ul className="space-y-2">
              {earlier.map((link) => (
                <li key={link.token} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="min-w-0 space-y-1">
                    <InviteLinkStatusBadge status={link.status} />
                    <span className="block text-xs text-muted-foreground">{describeInviteLink(link, now)}</span>
                  </span>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={inviteLinkPath(link.token)} aria-label={`See what a developer sees: ${describeInviteLink(link, now)}`}>
                      <EyeIcon aria-hidden data-icon="inline-start" />
                      Preview
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
