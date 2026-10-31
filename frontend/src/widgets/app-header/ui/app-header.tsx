import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";

type Props = {
  /** The current top-level page, marked with `aria-current`. */
  current?: "dashboard" | "developers" | "conversations";
  /** Extra status shown before the account menu (e.g. the connection badge). */
  status?: ReactNode;
};

const NAV = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "developers", href: "/developers", label: "Developers" },
  { id: "conversations", href: "/conversations", label: "Conversations" },
] as const;

/**
 * Top bar for signed-in screens: home link, navigation and the account menu (sign out).
 * Phones: two rows (brand, status and account on top; the links full width below).
 * From `sm` up: one row.
 */
export function AppHeader({ current, status }: Props) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 px-4 sm:h-14 sm:flex-nowrap sm:px-6">
        <Link href="/" className="flex h-14 items-center font-semibold tracking-tight sm:h-auto">
          NextNode
        </Link>
        <nav
          aria-label="Main"
          className="order-last -mx-2 flex w-[calc(100%+1rem)] gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:pb-0"
        >
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={current === item.id ? "page" : undefined}
              className="shrink-0 rounded-md px-2 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-8 sm:py-1"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          {status}
          {isAuthConfigured() ? (
            <Suspense fallback={<span className="size-7 rounded-full bg-muted" aria-hidden />}>
              <UserButton />
            </Suspense>
          ) : null}
        </div>
      </div>
    </header>
  );
}
