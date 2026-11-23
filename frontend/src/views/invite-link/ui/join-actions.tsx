"use client";

import { UserPlusIcon } from "lucide-react";

import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";

/** PROTOTYPE: joining with a link is under construction (the token check is server-side). */
export function JoinActions() {
  return (
    <Button onClick={() => underConstruction("Join with invite link")}>
      <UserPlusIcon aria-hidden data-icon="inline-start" />
      Join the team
    </Button>
  );
}
