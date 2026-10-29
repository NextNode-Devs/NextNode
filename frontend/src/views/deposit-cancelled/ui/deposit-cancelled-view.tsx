import { DepositResult } from "@/widgets/deposit-result";

/** Where Stripe Checkout sends the client after cancelling. */
export function DepositCancelledView({ projectId }: { projectId: Promise<string> }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-highlight">Project deposit</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Deposit checkout</h1>
      </header>
      <DepositResult mode="cancelled" projectId={projectId} />
    </main>
  );
}
