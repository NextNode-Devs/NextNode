import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";

type Props = {
  /** The current top-level page, marked with `aria-current`. */
  current?: "dashboard";
  /** Extra status shown before the account menu (e.g. the connection badge). */
  status?: ReactNode;
};

/** Top bar for signed-in screens: home link, navigation and the account menu (sign out). */
export function AppHeader({ current, status }: Props) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          NextNode
        </Link>
        <nav aria-label="Main" className="flex-1">
          <Link
            href="/dashboard"
            aria-current={current === "dashboard" ? "page" : undefined}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-8"
          >
            Dashboard
          </Link>
        </nav>
        {status}
        {isAuthConfigured() ? (
          <Suspense fallback={<span className="size-7 rounded-full bg-muted" aria-hidden />}>
            <UserButton />
          </Suspense>
        ) : null}
      </div>
    </header>
  );
}
