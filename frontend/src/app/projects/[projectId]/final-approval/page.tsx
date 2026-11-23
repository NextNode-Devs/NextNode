import { FinalApprovalView } from "@/views/project-closing";

export const metadata = { title: "Final approval" };

export default function Page({ params }: PageProps<"/projects/[projectId]/final-approval">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <FinalApprovalView projectId={params.then((p) => p.projectId)} />;
}
