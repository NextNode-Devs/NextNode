import { DepositCancelledView } from "@/views/deposit-cancelled";

export const metadata = { title: "Deposit checkout cancelled" };

export default function Page({ params }: PageProps<"/projects/[projectId]/deposit/cancelled">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <DepositCancelledView projectId={params.then((p) => p.projectId)} />;
}
