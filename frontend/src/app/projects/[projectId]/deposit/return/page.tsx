import { DepositReturnView } from "@/views/deposit-return";

export const metadata = { title: "Deposit payment" };

export default function Page({ params }: PageProps<"/projects/[projectId]/deposit/return">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <DepositReturnView projectId={params.then((p) => p.projectId)} />;
}
