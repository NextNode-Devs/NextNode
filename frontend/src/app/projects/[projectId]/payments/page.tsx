import { ProjectPaymentsView } from "@/views/project-payments";

export const metadata = { title: "Payments" };

export default function Page({ params }: PageProps<"/projects/[projectId]/payments">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <ProjectPaymentsView projectId={params.then((p) => p.projectId)} />;
}
