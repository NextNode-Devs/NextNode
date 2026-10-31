import { ProjectDetailView, type Notice } from "@/views/project-detail";

export const metadata = { title: "Project" };

export default function Page({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  const notice = searchParams.then((s): Notice => (s.created === "1" ? "created" : s.saved === "1" ? "saved" : null));
  return <ProjectDetailView projectId={params.then((p) => p.projectId)} notice={notice} />;
}
