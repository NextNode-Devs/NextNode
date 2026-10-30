import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";

type Props = {
  /** The current top-level page, marked with `aria-current`. */
  current?: "dashboard" | "conversations";
  /** Extra status shown before the account menu (e.g. the connection badge). */
  status?: ReactNode;
};

const NAV = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "conversations", href: "/conversations", label: "Conversations" },
] as const;

/** Top bar for signed-in screens: home link, navigation and the account menu (sign out). */
export function AppHeader({ current, status }: Props) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          NextNode
        </Link>
        <nav aria-label="Main" className="flex flex-1 gap-1">
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={current === item.id ? "page" : undefined}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-8"
            >
              {item.label}
            </Link>
          ))}
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
