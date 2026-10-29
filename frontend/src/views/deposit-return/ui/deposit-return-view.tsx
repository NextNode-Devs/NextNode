import { DepositResult } from "@/widgets/deposit-result";

/**
 * Where Stripe Checkout sends the client after paying. Arriving here changes
 * nothing: the status shown is the server's, confirmed only by Stripe's webhook.
 */
export function DepositReturnView({ projectId }: { projectId: Promise<string> }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-highlight">Project deposit</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your deposit payment</h1>
      </header>
      <DepositResult mode="return" projectId={projectId} />
    </main>
  );
}
