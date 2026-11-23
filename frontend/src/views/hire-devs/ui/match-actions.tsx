"use client";

import { MailPlusIcon, UserIcon } from "lucide-react";

import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";

/**
 * PROTOTYPE: sample developers have no portfolio or account, so both actions
 * show the shared under-construction toast. Real developers are still invited
 * from their portfolio (Phase 1, #5).
 */
export function MatchActions({ name }: { name: string }) {
  return (
    <>
      <Button size="sm" onClick={() => underConstruction("Invite to team")} aria-label={`Invite ${name} to your team`}>
        <MailPlusIcon aria-hidden data-icon="inline-start" />
        Invite
      </Button>
      <Button size="sm" variant="outline" onClick={() => underConstruction("Sample portfolio")} aria-label={`View ${name}'s portfolio`}>
        <UserIcon aria-hidden data-icon="inline-start" />
        View portfolio
      </Button>
    </>
  );
}
