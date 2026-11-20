import { ProjectWorkspaceView } from "@/views/project-workspace";

export const metadata = { title: "Documents" };

export default function Page({ params }: PageProps<"/projects/[projectId]/documents">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <ProjectWorkspaceView projectId={params.then((p) => p.projectId)} tab="documents" />;
}
