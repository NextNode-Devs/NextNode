import { ProjectWorkspaceView } from "@/views/project-workspace";

export const metadata = { title: "Chat" };

export default function Page({ params }: PageProps<"/projects/[projectId]/chat">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <ProjectWorkspaceView projectId={params.then((p) => p.projectId)} tab="chat" />;
}
