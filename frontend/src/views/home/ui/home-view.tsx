import { BackendStatus } from "@/widgets/backend-status";

/**
 * Development foundation screen. It states plainly that product screens are
 * not built yet rather than offering controls that do nothing.
 */
export function HomeView() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium text-highlight">Phase 1 · development foundation</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">NextNode</h1>
        <p className="text-lg text-muted-foreground">
          Build as a squad. Ship real projects. Prove it in your portfolio.
        </p>
      </header>

      <BackendStatus />

      <section aria-labelledby="not-built" className="space-y-2 text-sm text-muted-foreground">
        <h2 id="not-built" className="font-medium text-foreground">
          Not built yet
        </h2>
        <p>
          Sign-in, portfolios, projects, hiring, workspaces and payments are tracked as Phase 1
          issues. They will appear here as they are completed.
        </p>
      </section>
    </main>
  );
}
