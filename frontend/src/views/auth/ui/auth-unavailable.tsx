import { KeyRoundIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/** Shown instead of Clerk's forms when this deployment has no Clerk keys. */
export function AuthUnavailable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRoundIcon className="size-5" aria-hidden />
          <h2>Sign-in isn&apos;t set up here yet</h2>
        </CardTitle>
        <CardDescription>
          This copy of NextNode has no Clerk keys, so nobody can sign in or register. Add{" "}
          <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to{" "}
          <code>frontend/.env.local</code> (see <code>docs/external-accounts.md</code>) and restart.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
