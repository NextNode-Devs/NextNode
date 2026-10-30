import Link from "next/link";

import { isAuthConfigured } from "@/shared/config/env.public";
import { Button } from "@/shared/ui/shadcn/button";
import { BackendStatus } from "@/widgets/backend-status";

/**
 * Landing screen. Sign-in and registration are live (#1); the rest of Phase 1
 * arrives through the dashboard as each issue is completed.
 */
export function HomeView() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium text-highlight">Phase 1</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">NextNode</h1>
        <p className="text-lg text-muted-foreground">
          Build as a squad. Ship real projects. Prove it in your portfolio.
        </p>
      </header>

      {isAuthConfigured() ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign-in isn&apos;t set up on this copy of NextNode yet (no Clerk keys).
        </p>
      )}

      <BackendStatus />

      <section aria-labelledby="not-built" className="space-y-2 text-sm text-muted-foreground">
        <h2 id="not-built" className="font-medium text-foreground">
          Not built yet
        </h2>
        <p>
          Portfolios, projects, hiring, workspaces and payments are tracked as Phase 1 issues. They will
          appear on your dashboard as they are completed.
        </p>
      </section>
    </main>
  );
}
